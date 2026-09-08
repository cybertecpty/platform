/**
 * Workspace coverage reporting for CI — runs entirely inside GitHub Actions, no
 * third-party service (ADR 0007 amendment / issue #52).
 *
 * After `nx run-many -t test` (coverage collected in CI via `jest.preset.js`),
 * every project drops `coverage/<projectRoot>/coverage-{summary,final}.json`.
 * This script:
 *   1. sums the per-project `coverage-summary.json` totals into one workspace
 *      number and writes `coverage/coverage-summary.merged.json`;
 *   2. on a pull request, computes patch coverage — the covered fraction of the
 *      source lines the PR adds — from the merged `coverage-final.json` maps and
 *      `git diff`;
 *   3. writes a Markdown report to the job summary and, on a non-fork PR,
 *      upserts it as a single PR comment (matched by MARKER).
 *
 * Invoked from `.github/workflows/ci.yml` via `actions/github-script`:
 *   const report = require(`${process.env.GITHUB_WORKSPACE}/.github/scripts/coverage-report.cjs`);
 *   await report({ github, context, core });
 *
 * The pure helpers are exported for `node --test` (`coverage-report.test.cjs`).
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const MARKER = '<!-- coverage-report -->';
const METRICS = ['statements', 'branches', 'functions', 'lines'];

/** @param {number} n */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/** `covered / total * 100`, with the Istanbul convention that 0/0 is 100%. */
function pct(covered, total) {
  return total === 0 ? 100 : round2((covered / total) * 100);
}

/**
 * Fold an array of per-project `coverage-summary.json` `total` blocks into one
 * workspace total per metric (recomputing `pct` from the summed counts).
 *
 * @param {{ name: string, total: Record<string, { total: number, covered: number, skipped: number }> }[]} projects
 */
function sumTotals(projects) {
  /** @type {Record<string, { total: number, covered: number, skipped: number, pct: number }>} */
  const acc = {};
  for (const metric of METRICS) {
    let total = 0;
    let covered = 0;
    let skipped = 0;
    for (const project of projects) {
      const entry = project.total[metric];
      if (!entry) continue;
      total += entry.total;
      covered += entry.covered;
      skipped += entry.skipped;
    }
    acc[metric] = { total, covered, skipped, pct: pct(covered, total) };
  }
  return acc;
}

/**
 * Parse a `git diff --unified=0` patch into the set of added line numbers per
 * new-side file path.
 *
 * @param {string} diff
 * @returns {Map<string, Set<number>>}
 */
function parseAddedLines(diff) {
  /** @type {Map<string, Set<number>>} */
  const files = new Map();
  /** @type {string | null} */
  let current = null;
  let newLine = 0;

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const target = line.slice(4).trim().replace(/^b\//, '');
      current = target === '/dev/null' ? null : target;
      if (current && !files.has(current)) files.set(current, new Set());
      continue;
    }
    if (line.startsWith('@@')) {
      const match = /\+(\d+)(?:,(\d+))?/.exec(line);
      newLine = match ? Number(match[1]) : 0;
      continue;
    }
    if (!current) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      files.get(current)?.add(newLine);
      newLine++;
    }
    // `--unified=0` emits no context lines inside a hunk, so a deleted line
    // (`-…`) and any inter-hunk header text leave the new-side cursor untouched —
    // the next `@@` resets it.
  }
  return files;
}

/**
 * Collapse an Istanbul file-coverage object into `line number -> max hit count`
 * across every statement that touches the line.
 *
 * @param {{ statementMap: Record<string, { start: { line: number }, end: { line: number | null } }>, s: Record<string, number> }} fileCoverage
 * @returns {Map<number, number>}
 */
function lineHitMap(fileCoverage) {
  /** @type {Map<number, number>} */
  const hits = new Map();
  for (const [id, loc] of Object.entries(fileCoverage.statementMap)) {
    const count = fileCoverage.s[id] ?? 0;
    const start = loc.start.line;
    const end = loc.end?.line ?? start;
    for (let line = start; line <= end; line++) {
      const existing = hits.get(line);
      hits.set(line, existing === undefined ? count : Math.max(existing, count));
    }
  }
  return hits;
}

/**
 * Patch coverage: of the lines this PR adds that Istanbul instrumented, how many
 * are hit by at least one test. Lines with no instrumented statement (blank
 * lines, `import` lines, type-only files, non-`src` files) are not counted
 * either way.
 *
 * @param {Map<string, Set<number>>} addedByFile  repo-relative path -> added line numbers
 * @param {Map<string, object>} finalByRel        repo-relative path -> Istanbul file coverage
 */
function patchCoverage(addedByFile, finalByRel) {
  let covered = 0;
  let coverable = 0;
  /** @type {{ file: string, covered: number, coverable: number, pct: number }[]} */
  const perFile = [];

  for (const [file, lines] of addedByFile) {
    const fileCoverage = finalByRel.get(file);
    if (!fileCoverage) continue;
    const hitByLine = lineHitMap(fileCoverage);
    let fileCovered = 0;
    let fileCoverable = 0;
    for (const line of lines) {
      if (!hitByLine.has(line)) continue;
      fileCoverable++;
      if ((hitByLine.get(line) ?? 0) > 0) fileCovered++;
    }
    if (fileCoverable === 0) continue;
    covered += fileCovered;
    coverable += fileCoverable;
    perFile.push({
      file,
      covered: fileCovered,
      coverable: fileCoverable,
      pct: pct(fileCovered, fileCoverable)
    });
  }

  perFile.sort((a, b) => a.file.localeCompare(b.file));
  return {
    covered,
    coverable,
    pct: coverable === 0 ? null : pct(covered, coverable),
    perFile
  };
}

/** @param {Record<string, { pct: number }>} totals */
function oneLine(totals) {
  return METRICS.map(m => `${totals[m].pct}% ${m}`).join(' · ');
}

/**
 * @param {{
 *   projects: { name: string, total: Record<string, { pct: number }> }[],
 *   workspace: Record<string, { pct: number }>,
 *   patch: { covered: number, coverable: number, pct: number | null, perFile: { file: string, covered: number, coverable: number, pct: number }[] } | null
 * }} input
 */
function renderMarkdown({ projects, workspace, patch }) {
  const lines = [MARKER, '', '## Test coverage', ''];
  lines.push(`**Workspace:** ${oneLine(workspace)}`, '');
  lines.push('| Project | Statements | Branches | Functions | Lines |');
  lines.push('| --- | --: | --: | --: | --: |');
  for (const project of projects) {
    const cells = METRICS.map(m => `${project.total[m].pct}%`);
    lines.push(`| ${project.name} | ${cells.join(' | ')} |`);
  }
  lines.push('');

  if (patch) {
    if (patch.pct === null) {
      lines.push('**Patch coverage:** no instrumented lines changed.');
    } else {
      lines.push(
        `**Patch coverage:** ${patch.pct}% (${patch.covered}/${patch.coverable} changed lines)`,
        ''
      );
      lines.push('<details><summary>Changed files</summary>', '');
      lines.push('| File | Patch % | Covered / Coverable |');
      lines.push('| --- | --: | --: |');
      for (const file of patch.perFile) {
        lines.push(`| ${file.file} | ${file.pct}% | ${file.covered} / ${file.coverable} |`);
      }
      lines.push('', '</details>');
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CI glue (not exercised by the unit tests)
// ---------------------------------------------------------------------------

/** @param {string} file */
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Absolute paths of every `coverage/**\/<basename>` report. Uses a recursive
 * `readdirSync` rather than `fs.globSync` — `actions/github-script` runs on its
 * own bundled Node, older than the workspace's, and `fs.globSync` is not there.
 *
 * @param {string} root
 * @param {string} basename
 */
function findReports(root, basename) {
  const coverageRoot = path.join(root, 'coverage');
  if (!fs.existsSync(coverageRoot)) return [];
  return fs
    .readdirSync(coverageRoot, { recursive: true })
    .map(entry => entry.toString())
    .filter(rel => path.basename(rel) === basename)
    .map(rel => path.join(coverageRoot, rel));
}

/** @param {string} root */
function collectProjects(root) {
  const coverageRoot = path.join(root, 'coverage');
  return findReports(root, 'coverage-summary.json')
    .map(abs => ({
      name: path.relative(coverageRoot, path.dirname(abs)).split(path.sep).join('/'),
      total: readJson(abs).total
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** @param {string} root */
function mergeFinalByRel(root) {
  /** @type {Map<string, object>} */
  const byRel = new Map();
  for (const abs of findReports(root, 'coverage-final.json')) {
    const data = readJson(abs);
    for (const [absPath, fileCoverage] of Object.entries(data)) {
      const relPath = path.relative(root, absPath).split(path.sep).join('/');
      if (!byRel.has(relPath)) byRel.set(relPath, fileCoverage);
    }
  }
  return byRel;
}

/** @param {{ base: string, head: string }} range */
function changedLines({ base, head }) {
  const diff = execFileSync(
    'git',
    [
      'diff',
      '--unified=0',
      '--no-color',
      '--diff-filter=d',
      `${base}...${head}`,
      '--',
      '*.ts',
      ':(exclude)**/*.spec.ts'
    ],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  );
  return parseAddedLines(diff);
}

/** @param {{ github: any, context: any, body: string }} args */
async function upsertComment({ github, context, body }) {
  const { owner, repo } = context.repo;
  const issueNumber = context.payload.pull_request.number;
  const { data: comments } = await github.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100
  });
  const existing = comments.find(comment => comment.body?.includes(MARKER));
  if (existing) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
  } else {
    await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
  }
}

/** @param {{ github: any, context: any, core: any }} args */
async function report({ github, context, core }) {
  const root = process.env.GITHUB_WORKSPACE ?? process.cwd();

  const projects = collectProjects(root);
  if (projects.length === 0) {
    core.warning('coverage-report: no coverage-summary.json files under coverage/ — skipping.');
    return;
  }
  core.info(
    `coverage-report: ${projects.length} project(s): ${projects.map(p => p.name).join(', ')}`
  );

  const workspace = sumTotals(projects);
  fs.writeFileSync(
    path.join(root, 'coverage', 'coverage-summary.merged.json'),
    `${JSON.stringify({ workspace, projects }, null, 2)}\n`
  );
  core.info(`coverage-report: workspace ${oneLine(workspace)}`);

  let patch = null;
  if (context.eventName === 'pull_request') {
    const base = process.env.NX_BASE || context.payload.pull_request.base.sha;
    const head = process.env.NX_HEAD || context.payload.pull_request.head.sha;
    patch = patchCoverage(changedLines({ base, head }), mergeFinalByRel(root));
  }

  const body = renderMarkdown({ projects, workspace, patch });
  await core.summary.addRaw(body).write();

  const isFork = context.payload.pull_request?.head?.repo?.fork ?? false;
  if (context.eventName === 'pull_request' && !isFork) {
    await upsertComment({ github, context, body });
  }
}

module.exports = report;
module.exports.MARKER = MARKER;
module.exports.sumTotals = sumTotals;
module.exports.parseAddedLines = parseAddedLines;
module.exports.lineHitMap = lineHitMap;
module.exports.patchCoverage = patchCoverage;
module.exports.renderMarkdown = renderMarkdown;
module.exports.pct = pct;
