import { gitLocalUserEmail, gitLocalUserName } from '@cybertecpty/git-utils';
import {
  formatFiles,
  joinPathFragments,
  logger,
  type ProjectConfiguration,
  readProjectConfiguration,
  type Tree,
  updateProjectConfiguration,
  writeJson
} from '@nx/devkit';
import { valid as validSemver } from 'semver';
import type { ReleaseManifestGeneratorOptions } from './schema';

/** Name of the file the generator writes; never configurable. */
const MANIFEST_FILENAME = 'release-manifest.json';

/** Directory, relative to an application's root, that holds its manifest by default. */
const APP_MANIFEST_DIR = 'public';

/**
 * Application build executors that copy the project's `public/` directory to the
 * build output root automatically. A manifest written under `public/` for one of
 * these needs no `build.options.assets` entry.
 */
const PUBLIC_DIR_APP_BUILDERS = new Set([
  '@angular/build:application',
  '@angular-devkit/build-angular:application',
  '@nx/angular:application'
]);

/** The `build` target shape this generator reads and, for libraries, extends. */
interface BuildTarget {
  executor?: string;
  options?: { assets?: unknown[] };
}

/** Contents of the generated `release-manifest.json`, keys in alphabetical order. */
interface ReleaseManifest {
  author?: string;
  project: string;
  releaseCommit: string;
  releaseDate: string;
  version: string;
}

/**
 * Writes a `release-manifest.json` for a single project — author, project
 * identity, release commit, date and version — and wires it into the project's
 * `build` target so it ships with the compiled output.
 *
 * Libraries get the file at their project root; applications get it under
 * `public/`. `--dirPath` overrides the location (relative to the project root).
 * All inputs are validated before anything is written.
 */
export async function releaseManifestGenerator(
  tree: Tree,
  options: ReleaseManifestGeneratorOptions
): Promise<void> {
  const { project, version, releaseCommit, dirPath, skipFormat } = options;

  const projectConfig = readProjectConfiguration(tree, project);

  if (validSemver(version) === null) {
    throw new Error(
      `"${version}" is not a valid semantic version. Pass the release version positionally, ` +
        `e.g. \`nx g @cybertecpty/release-plugin:release-manifest ${project} 1.2.3\`.`
    );
  }

  const releaseDate = normalizeReleaseDate(options.releaseDate);
  const isApp = projectConfig.projectType === 'application';
  const author = await resolveAuthor(options.author, isApp);

  const manifestDir = resolveManifestDir(projectConfig.root, dirPath, isApp);
  const manifestPath = joinPathFragments(manifestDir, MANIFEST_FILENAME);

  const manifest: ReleaseManifest = {
    ...(author === '' ? {} : { author }),
    project,
    releaseCommit,
    releaseDate,
    version
  };

  writeJson(tree, manifestPath, manifest);
  wireBuildAsset(tree, projectConfig, manifestDir, manifestPath);

  if (!skipFormat) {
    await formatFiles(tree);
  }
}

/**
 * Resolves the directory the manifest is written to, relative to the project
 * root: `--dirPath` when given a non-empty value, otherwise `public/` for
 * applications and the project root for libraries. Throws when `--dirPath`
 * would leave the project root (a `..` segment).
 */
function resolveManifestDir(root: string, dirPath: string | undefined, isApp: boolean): string {
  const relativeDir =
    dirPath === undefined || dirPath === '' ? (isApp ? APP_MANIFEST_DIR : '') : dirPath;

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
 * - applications get the local git user name only;
 * - libraries get `<name> (<email>)`, dropping the parenthesized email when it
 *   is not configured;
 * - returns `''` when no name can be resolved, so the caller omits the key.
 */
async function resolveAuthor(explicit: string | undefined, isApp: boolean): Promise<string> {
  if (explicit !== undefined && explicit !== '') {
    return explicit;
  }

  const name = (await gitLocalUserName()).trim();

  if (name === '' || isApp) {
    return name;
  }

  const email = (await gitLocalUserEmail()).trim();

  return email === '' ? name : `${name} (${email})`;
}

/**
 * Ensures the project's `build` target emits the manifest. No-ops when the
 * manifest sits under an application's `public/` and the builder copies that
 * directory automatically (or the build target is inferred and so invisible
 * here); warns — without failing — when there is a `project.json` `build`
 * target it cannot wire; otherwise appends the manifest path to
 * `build.options.assets` unless an existing entry already covers it.
 */
function wireBuildAsset(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  manifestDir: string,
  manifestPath: string
): void {
  const isApp = projectConfig.projectType === 'application';
  const inPublicDir =
    isApp && isWithin(joinPathFragments(projectConfig.root, APP_MANIFEST_DIR), manifestDir);
  const build = projectConfig.targets?.build as BuildTarget | undefined;

  if (inPublicDir && (build === undefined || isPublicDirBuilder(build.executor))) {
    return;
  }

  if (build === undefined) {
    logger.warn(
      `Project "${projectConfig.name ?? projectConfig.root}" has no \`build\` target in ` +
        `project.json; wrote ${manifestPath}, but you must add it to the build's \`assets\` ` +
        `yourself so it reaches the build output.`
    );

    return;
  }

  const buildOptions = (build.options ??= {});
  const assets = buildOptions.assets ?? [];

  if (assets.some(entry => assetCovers(entry, manifestPath))) {
    return;
  }

  buildOptions.assets = [...assets, manifestPath];
  updateProjectConfiguration(tree, projectConfig.name ?? projectConfig.root, projectConfig);
}

/** True when `child` is `parent` itself or a path nested under it. */
function isWithin(parent: string, child: string): boolean {
  return child === parent || child.startsWith(`${parent}/`);
}

/** True for build executors that copy the project's `public/` folder to the output root. */
function isPublicDirBuilder(executor: string | undefined): boolean {
  return executor !== undefined && PUBLIC_DIR_APP_BUILDERS.has(executor);
}

/** True when an `assets` entry (string glob or `{ input, glob }`) matches `manifestPath`. */
function assetCovers(entry: unknown, manifestPath: string): boolean {
  let pattern: string | undefined;

  if (typeof entry === 'string') {
    pattern = entry;
  } else if (isGlobObject(entry)) {
    pattern = joinPathFragments(entry.input, entry.glob);
  }

  return pattern !== undefined && globToRegExp(pattern).test(manifestPath);
}

/** Narrows an unknown `assets` entry to the `@nx/js` object form. */
function isGlobObject(entry: unknown): entry is { glob: string; input: string } {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as Record<string, unknown>).glob === 'string' &&
    typeof (entry as Record<string, unknown>).input === 'string'
  );
}

/** Compiles a shell-style glob (`*`, `**`) into an anchored regular expression. */
function globToRegExp(glob: string): RegExp {
  const pattern = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*|\*/g, match => (match === '**' ? '.*' : '[^/]*'));

  return new RegExp(`^${pattern}$`);
}

export default releaseManifestGenerator;
