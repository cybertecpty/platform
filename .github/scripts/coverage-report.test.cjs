const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  MARKER,
  sumTotals,
  parseAddedLines,
  lineHitMap,
  parseLcov,
  lcovTotal,
  collectProjects,
  mergeFinalByRel,
  patchCoverage,
  renderMarkdown,
  pct
} = require('./coverage-report.cjs');

const metric = (total, covered) => ({
  total,
  covered,
  skipped: 0,
  pct: total === 0 ? 100 : Math.round((covered / total) * 10000) / 100
});
const fullTotal = o => ({
  statements: metric(o.s?.[0] ?? 0, o.s?.[1] ?? 0),
  branches: metric(o.b?.[0] ?? 0, o.b?.[1] ?? 0),
  functions: metric(o.f?.[0] ?? 0, o.f?.[1] ?? 0),
  lines: metric(o.l?.[0] ?? 0, o.l?.[1] ?? 0)
});

describe('pct', () => {
  it('treats 0 / 0 as 100 (Istanbul convention)', () => {
    assert.equal(pct(0, 0), 100);
  });

  it('rounds to two decimals', () => {
    assert.equal(pct(1, 3), 33.33);
  });
});

describe('sumTotals', () => {
  it('sums counts across projects and recomputes pct from the totals', () => {
    const projects = [
      { name: 'a', total: fullTotal({ s: [10, 10], b: [4, 3], f: [2, 2], l: [10, 10] }) },
      { name: 'b', total: fullTotal({ s: [10, 5], b: [6, 3], f: [2, 1], l: [10, 5] }) }
    ];
    const ws = sumTotals(projects);
    assert.equal(ws.statements.covered, 15);
    assert.equal(ws.statements.total, 20);
    assert.equal(ws.statements.pct, 75);
    assert.equal(ws.branches.pct, 60);
    assert.equal(ws.functions.pct, 75);
  });

  it('reports 100% for a metric with no coverable entities', () => {
    const projects = [
      { name: 'a', total: fullTotal({ s: [0, 0], b: [0, 0], f: [0, 0], l: [0, 0] }) }
    ];
    assert.equal(sumTotals(projects).branches.pct, 100);
  });
});

describe('parseAddedLines', () => {
  it('maps added line numbers to the new-side path and ignores deletions', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,2 +1,3 @@',
      '+const x = 1;',
      '+const y = 2;',
      '+const z = 3;',
      '@@ -10 +11,0 @@',
      '-gone();'
    ].join('\n');
    const added = parseAddedLines(diff);
    assert.deepEqual([...added.get('src/a.ts')], [1, 2, 3]);
  });

  it('skips files added against /dev/null on the new side (pure deletion)', () => {
    const diff = ['--- a/src/gone.ts', '+++ /dev/null', '@@ -1,2 +0,0 @@', '-a', '-b'].join('\n');
    assert.equal(parseAddedLines(diff).size, 0);
  });

  it('advances the new-side cursor across multiple hunks', () => {
    const diff = [
      '+++ b/src/b.ts',
      '@@ -1 +1 @@',
      '+first',
      '@@ -20,0 +21,2 @@',
      '+twentyone',
      '+twentytwo'
    ].join('\n');
    assert.deepEqual([...parseAddedLines(diff).get('src/b.ts')], [1, 21, 22]);
  });
});

describe('lineHitMap', () => {
  it('takes the max hit count of every statement covering a line', () => {
    const fileCoverage = {
      statementMap: {
        0: { start: { line: 1 }, end: { line: 1 } },
        1: { start: { line: 2 }, end: { line: 4 } },
        2: { start: { line: 4 }, end: { line: 4 } }
      },
      s: { 0: 3, 1: 0, 2: 5 }
    };
    const hits = lineHitMap(fileCoverage);
    assert.equal(hits.get(1), 3);
    assert.equal(hits.get(2), 0);
    assert.equal(hits.get(3), 0);
    assert.equal(hits.get(4), 5); // max(0, 5)
  });

  it('falls back to the start line when end.line is null', () => {
    const hits = lineHitMap({
      statementMap: { 0: { start: { line: 7 }, end: { line: null } } },
      s: { 0: 1 }
    });
    assert.deepEqual([...hits.keys()], [7]);
  });
});

describe('patchCoverage', () => {
  const finalByRel = new Map([
    [
      'src/a.ts',
      {
        statementMap: {
          0: { start: { line: 1 }, end: { line: 1 } },
          1: { start: { line: 2 }, end: { line: 2 } },
          2: { start: { line: 3 }, end: { line: 3 } }
        },
        s: { 0: 1, 1: 0, 2: 4 }
      }
    ]
  ]);

  it('scores only added lines that land on an instrumented statement', () => {
    // lines 1 (hit), 2 (miss), 3 (hit), 4 (not instrumented -> ignored)
    const added = new Map([['src/a.ts', new Set([1, 2, 3, 4])]]);
    const result = patchCoverage(added, finalByRel);
    assert.equal(result.coverable, 3);
    assert.equal(result.covered, 2);
    assert.equal(result.pct, 66.67);
    assert.deepEqual(result.perFile, [{ file: 'src/a.ts', covered: 2, coverable: 3, pct: 66.67 }]);
  });

  it('ignores changed files with no instrumented coverage (specs, type-only, non-src)', () => {
    const added = new Map([['src/a.spec.ts', new Set([1, 2, 3])]]);
    const result = patchCoverage(added, finalByRel);
    assert.equal(result.pct, null);
    assert.deepEqual(result.perFile, []);
  });

  it('returns pct null when the diff touches no coverable line', () => {
    const added = new Map([['src/a.ts', new Set([99, 100])]]);
    assert.equal(patchCoverage(added, finalByRel).pct, null);
  });
});

const SAMPLE_LCOV = [
  'SF:/repo/libs/api/Foo.cs',
  'FN:3,Foo::A()',
  'FNDA:2,Foo::A()',
  'FN:8,Foo::B()',
  'FNDA:0,Foo::B()',
  'DA:4,2',
  'DA:5,2',
  'DA:9,0',
  'BRDA:5,0,0,1',
  'BRDA:5,0,1,0',
  'BRDA:5,1,0,-',
  'LF:3',
  'LH:2',
  'BRF:3',
  'BRH:1',
  'FNF:2',
  'FNH:1',
  'end_of_record',
  'SF:/repo/libs/api/Bar.cs',
  'DA:2,1',
  'end_of_record',
  ''
].join('\n');

describe('parseLcov', () => {
  it('reads per-file line hits and function and branch counts', () => {
    const files = parseLcov(SAMPLE_LCOV);
    const foo = files.get('/repo/libs/api/Foo.cs');
    assert.deepEqual(
      [...foo.lines],
      [
        [4, 2],
        [5, 2],
        [9, 0]
      ]
    );
    assert.deepEqual(foo.functions, { total: 2, covered: 1 });
    assert.deepEqual(foo.branches, { total: 3, covered: 1 });
  });

  it('counts FN, FNDA and BRDA records when the summary lines are absent', () => {
    const files = parseLcov(SAMPLE_LCOV.replace(/^(LF|LH|BRF|BRH|FNF|FNH):.*\n/gm, ''));
    const foo = files.get('/repo/libs/api/Foo.cs');
    assert.deepEqual(foo.functions, { total: 2, covered: 1 });
    assert.deepEqual(foo.branches, { total: 3, covered: 1 });
  });

  it('prefers the FNF, FNH, BRF and BRH summary lines over counting records', () => {
    const files = parseLcov(
      ['SF:/a.cs', 'DA:1,1', 'FNF:5', 'FNH:4', 'BRF:6', 'BRH:3', 'end_of_record'].join('\n')
    );
    const file = files.get('/a.cs');
    assert.deepEqual(file.functions, { total: 5, covered: 4 });
    assert.deepEqual(file.branches, { total: 6, covered: 3 });
  });

  it('tolerates CRLF line endings', () => {
    const files = parseLcov(SAMPLE_LCOV.replaceAll('\n', '\r\n'));
    assert.equal(files.get('/repo/libs/api/Bar.cs').lines.get(2), 1);
  });
});

describe('lcovTotal', () => {
  it('reports lines as statements and sums every file', () => {
    const total = lcovTotal(parseLcov(SAMPLE_LCOV));
    assert.deepEqual(total.lines, { total: 4, covered: 3, skipped: 0, pct: 75 });
    assert.deepEqual(total.statements, total.lines);
    assert.deepEqual(total.functions, { total: 2, covered: 1, skipped: 0, pct: 50 });
    assert.deepEqual(total.branches, { total: 3, covered: 1, skipped: 0, pct: 33.33 });
  });
});

describe('patchCoverage (lcov)', () => {
  it('scores added C# lines by hit count and ignores lines lcov does not list', () => {
    const hits = parseLcov(SAMPLE_LCOV).get('/repo/libs/api/Foo.cs').lines;
    const added = new Map([['libs/api/Foo.cs', new Set([1, 4, 9])]]);
    const result = patchCoverage(added, new Map([['libs/api/Foo.cs', hits]]));
    assert.equal(result.coverable, 2);
    assert.equal(result.covered, 1);
  });
});

describe('collectProjects / mergeFinalByRel', () => {
  const makeRoot = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cov-'));
    const write = (rel, text) => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    };
    write(
      'coverage/libs/ts/coverage-summary.json',
      JSON.stringify({ total: fullTotal({ s: [4, 4], b: [2, 1], f: [1, 1], l: [4, 4] }) })
    );
    write(
      'coverage/libs/net/coverage.info',
      SAMPLE_LCOV.replaceAll('/repo/', `${root.replaceAll('\\', '/')}/`)
    );
    write('coverage/libs/empty/other.txt', 'x');
    return root;
  };

  it('lists TypeScript and .NET projects, skipping a project with no report', () => {
    const root = makeRoot();
    const projects = collectProjects(root);
    assert.deepEqual(
      projects.map(p => p.name),
      ['libs/net', 'libs/ts']
    );
    const sum = sumTotals(projects);
    assert.equal(sum.lines.total, 8);
    assert.equal(sum.lines.covered, 7);
    assert.equal(sum.branches.total, 5);
    assert.equal(sum.functions.total, 3);
  });

  it('maps lcov files to repo-relative line hits', () => {
    const root = makeRoot();
    const byRel = mergeFinalByRel(root);
    assert.equal(byRel.get('libs/api/Foo.cs').get(9), 0);
  });

  it('returns nothing when there is no coverage folder', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cov-'));
    assert.deepEqual(collectProjects(root), []);
  });
});

describe('renderMarkdown', () => {
  const projects = [
    { name: 'libs/x', total: fullTotal({ s: [10, 10], b: [2, 2], f: [1, 1], l: [10, 10] }) }
  ];
  const workspace = sumTotals(projects);

  it('leads with the marker so the comment can be found and updated', () => {
    const md = renderMarkdown({ projects, workspace, patch: null });
    assert.ok(md.startsWith(MARKER));
    assert.match(md, /\| libs\/x \| 100% \| 100% \| 100% \| 100% \|/);
  });

  it('renders a patch-coverage line and a changed-files table when patch data is present', () => {
    const md = renderMarkdown({
      projects,
      workspace,
      patch: {
        covered: 3,
        coverable: 4,
        pct: 75,
        perFile: [{ file: 'libs/x/src/a.ts', covered: 3, coverable: 4, pct: 75 }]
      }
    });
    assert.match(md, /\*\*Patch coverage:\*\* 75% \(3\/4 changed lines\)/);
    assert.match(md, /<details><summary>Changed files<\/summary>/);
  });

  it('states when a PR changed no instrumented lines', () => {
    const md = renderMarkdown({
      projects,
      workspace,
      patch: { covered: 0, coverable: 0, pct: null, perFile: [] }
    });
    assert.match(md, /no instrumented lines changed/);
  });
});

describe('renderMarkdown (affected-only PR runs)', () => {
  const projects = [
    { name: 'libs/x', total: fullTotal({ s: [10, 10], b: [2, 2], f: [1, 1], l: [10, 10] }) }
  ];
  const workspace = sumTotals(projects);

  it('labels the total as the whole workspace by default', () => {
    const md = renderMarkdown({ projects, workspace, patch: null });
    assert.match(md, /\*\*Workspace:\*\* 100% statements/);
  });

  it('labels the total as affected projects only when affectedOnly is set', () => {
    const md = renderMarkdown({ projects, workspace, patch: null, affectedOnly: true });
    assert.match(md, /\*\*Affected projects:\*\* 100% statements/);
    assert.doesNotMatch(md, /\*\*Workspace:\*\*/);
  });

  it('states that no affected project reported coverage, without a table', () => {
    const md = renderMarkdown({ projects: [], workspace: null, patch: null, affectedOnly: true });
    assert.ok(md.startsWith(MARKER));
    assert.match(md, /No affected project reported coverage/);
    assert.doesNotMatch(md, /\| Project \|/);
  });
});
