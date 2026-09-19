import { FileBufferArchiver, type FileArchiveSource } from '@cybertecpty/fs-utils';
import { listFilesRecursively } from '@cybertecpty/nx-utils';
import { joinPathFragments, logger, normalizePath, type Tree } from '@nx/devkit';
import { basename, posix } from 'node:path';
import type { FileArchiveGeneratorOptions } from './schema';

/**
 * Archives every file under `source` into a single `.zip` or `.tar`, preserving
 * `source`'s internal directory structure as the archive's entry names.
 *
 * Guard conditions (an empty `source`; an existing archive without `--overwrite`)
 * warn and no-op rather than throwing, so this composes safely in scripts. No
 * `formatFiles` call — the output is a binary archive, not source text.
 *
 * Returns the workspace-relative archive path, whether or not it was written
 * this run, so callers can locate the (possibly pre-existing) output.
 */
export async function fileArchiveGenerator(
  tree: Tree,
  options: FileArchiveGeneratorOptions
): Promise<string> {
  // Normalize up front: `Tree` paths (and `joinPathFragments`, used for `archivePath`
  // below) are always forward-slash, but a CLI-supplied `source` may arrive with
  // OS-native separators (backslashes on Windows) — left as-is, that mismatch would
  // corrupt every entry name computed via `posix.relative` below.
  const source = normalizePath(options.source);
  const { overwrite = false, format = 'zip' } = options;

  const archivePath = joinPathFragments(
    options.destination ?? source,
    options.filename ?? `${basename(source)}.${format}`
  );

  // Exclude the archive's own output path from the walk: `destination` defaults to
  // `source`, so without this a re-run (especially with `--overwrite`) would embed
  // the previous run's archive bytes inside the new one.
  const filePaths = listFilesRecursively(tree, source).filter(filePath => filePath !== archivePath);

  if (filePaths.length === 0) {
    logger.warn(`No files found under "${source}"; skipping archive creation.`);
    return archivePath;
  }

  if (tree.exists(archivePath) && !overwrite) {
    logger.warn(
      `"${archivePath}" already exists; pass --overwrite to replace it. Skipping archive creation.`
    );
    return archivePath;
  }

  logger.info(`Creating archive file from source path: ${options.source} ...`);

  const sources: FileArchiveSource[] = filePaths.map(filePath => ({
    name: posix.relative(source, filePath),
    content: tree.read(filePath) as Buffer
  }));

  logger.info(`Found ${sources.length} files to include in the archive.`);

  const archiver = new FileBufferArchiver(...sources);
  const buffer = format === 'tar' ? await archiver.tar({ gzip: false }) : await archiver.zip();

  tree.write(archivePath, buffer);

  logger.info(`Archive created: ${archivePath} (${buffer.length} bytes)`);

  return archivePath;
}

export default fileArchiveGenerator;
