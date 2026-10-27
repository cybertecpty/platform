// Pre-commit ESLint runner (lint-staged): applies autofixes for mechanical rules only and
// reports everything else, so a finding with a semantic fixer fails the commit instead of
// being rewritten after the author stopped looking. See mechanical-rules.cjs.
const { ESLint } = require('eslint');
const { isMechanicalFix } = require('./mechanical-rules.cjs');

async function main(files) {
  const eslint = new ESLint({ fix: isMechanicalFix, warnIgnored: false });

  const results = await eslint.lintFiles(files);
  await ESLint.outputFixes(results);

  const output = await (await eslint.loadFormatter('stylish')).format(results);
  if (output) {
    console.log(output);
  }

  process.exitCode = results.some(result => result.errorCount > 0) ? 1 : 0;
}

main(process.argv.slice(2)).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
