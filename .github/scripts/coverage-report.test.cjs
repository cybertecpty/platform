const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  MARKER,
  sumTotals,
  parseAddedLines,
  lineHitMap,
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
