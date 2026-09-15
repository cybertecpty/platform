import { gitLocalUserEmail, gitLocalUserName } from '@cybertecpty/git-utils';
import type { ReleaseManifest } from '@cybertecpty/shared-types';
import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  type Tree,
  writeJson
} from '@nx/devkit';
import { valid as validSemver } from 'semver';
import type { ReleaseManifestGeneratorOptions } from './schema';

/** Name of the file the generator writes; never configurable. */
const MANIFEST_FILENAME = 'release-manifest.json';

/**
 * Writes a `release-manifest.json` for a single project — author, project
 * identity, release commit, date and version.
 *
 * The file lands at the project root by default; `--dirPath` moves it elsewhere
 * within the project. It is up to each project's build to copy the manifest into
 * its output (e.g. via the build target's `assets`). All inputs are validated
 * before anything is written.
 *
 * Returns the workspace-relative path the manifest was written to.
 */
export async function releaseManifestGenerator(
  tree: Tree,
  options: ReleaseManifestGeneratorOptions
): Promise<string> {
  const { project, version, sourceCommit, dirPath, skipFormat } = options;

  const projectConfig = readProjectConfiguration(tree, project);

  if (validSemver(version) === null) {
    throw new Error(
      `"${version}" is not a valid semantic version. Pass the release version positionally, ` +
        `e.g. \`nx g @cybertecpty/release-plugin:release-manifest ${project} 1.2.3\`.`
    );
  }

  const releaseDate = normalizeReleaseDate(options.releaseDate);
  const author = await resolveAuthor(options.author);

  const manifestDir = resolveManifestDir(projectConfig.root, dirPath);
  const manifestPath = joinPathFragments(manifestDir, MANIFEST_FILENAME);

  const manifest: ReleaseManifest = {
    ...(author === '' ? {} : { author }),
    project,
    releaseDate,
    sourceCommit,
    version
  };

  writeJson(tree, manifestPath, manifest);

  if (!skipFormat) {
    await formatFiles(tree);
  }

  return manifestPath;
}

/**
 * Resolves the directory the manifest is written to, relative to the project
 * root — the project root itself unless `--dirPath` moves it. Throws when
 * `--dirPath` would leave the project root (a `..` segment).
 */
function resolveManifestDir(root: string, dirPath: string | undefined): string {
  const relativeDir = dirPath ?? '';

  if (relativeDir.split(/[/\\]/).includes('..')) {
    throw new Error(
      `"${dirPath}" is not a valid --dirPath: it must stay within the project root (no \`..\` segments).`
    );
  }

  return joinPathFragments(root, relativeDir);
}

/**
 * Parses `input` and re-serializes it as a canonical ISO 8601 UTC string.
 * Defaults to the current time. Throws when `input` is not a parseable date.
 */
function normalizeReleaseDate(input: string | undefined): string {
  if (input === undefined) {
    return new Date().toISOString();
  }

  const parsed = new Date(input);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `"${input}" is not a valid release date. Pass a value JavaScript's \`Date\` can parse, ` +
        `e.g. \`2026-04-22T15:30:00.000Z\`.`
    );
  }

  return parsed.toISOString();
}

/**
 * Resolves the manifest `author`:
 * - an explicit non-empty `--author` wins;
 * - otherwise `<git user name> (<git user email>)`, dropping the parenthesized
 *   email when it is not configured;
 * - returns `''` when no name can be resolved, so the caller omits the key.
 */
async function resolveAuthor(explicit: string | undefined): Promise<string> {
  if (explicit !== undefined && explicit !== '') {
    return explicit;
  }

  const name = (await gitLocalUserName()).trim();

  if (name === '') {
    return '';
  }

  const email = (await gitLocalUserEmail()).trim();

  return email === '' ? name : `${name} (${email})`;
}

export default releaseManifestGenerator;
