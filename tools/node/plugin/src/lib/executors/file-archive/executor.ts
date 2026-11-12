import { FileBufferArchiver, listFiles, type FileArchiveSource } from '@cybertecpty/fs-utils';
import { resolveOutputFolder } from '@cybertecpty/nx-utils';
import { joinPathFragments, logger, normalizePath, type PromiseExecutor } from '@nx/devkit';
import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import type { FileArchiveExecutorOptions } from './schema';

/**
 * Archive a folder, or a target's resolved build output, into a zip or tar.
 *
 * Reads the real file system, so it can run as a cached target after `build`. The archive
 * defaults to a sibling of the folder (`<source>.<format>`) so it can't include itself; an
 * existing archive at the output path is replaced and never added to the new one.
 */
const fileArchiveExecutor: PromiseExecutor<FileArchiveExecutorOptions> = async (
  options,
  context
) => {
  const projectName = context.projectName;

  if (!projectName) {
    logger.error('file-archive must run as a project target.');
    return { success: false };
  }

  const resolved = resolveOutputFolder({
    projectGraph: context.projectGraph,
    projectName,
    explicitFolder: options.source && normalizePath(options.source),
    buildTarget: options.buildTarget,
    hint: 'Set the source option on the archive target.'
  });

  if ('error' in resolved) {
    logger.error(resolved.error);
    return { success: false };
  }

  const source = resolved.folder;
  const format = options.format ?? 'zip';

  if (
    !existsSync(join(context.root, source)) ||
    !statSync(join(context.root, source)).isDirectory()
  ) {
    logger.error(
      `The folder to archive "${source}" does not exist. Build the project first, or set the source option.`
    );
    return { success: false };
  }

  const archivePath = joinPathFragments(
    options.destination ?? posix.dirname(source),
    options.filename ?? `${posix.basename(source)}.${format}`
  );

  const entryNames = listFiles(join(context.root, source)).filter(
    entryName => joinPathFragments(source, entryName) !== archivePath
  );

  if (entryNames.length === 0) {
    logger.error(`The folder to archive "${source}" contains no files.`);
    return { success: false };
  }

  const sources: FileArchiveSource[] = await Promise.all(
    entryNames.map(async name => ({
      name,
      content: await readFile(join(context.root, source, name))
    }))
  );

  const archiver = new FileBufferArchiver(...sources);
  const buffer = format === 'tar' ? await archiver.tar({ gzip: false }) : await archiver.zip();

  await mkdir(join(context.root, posix.dirname(archivePath)), { recursive: true });
  await writeFile(join(context.root, archivePath), buffer);

  logger.info(`Archive created: ${archivePath} (${sources.length} files, ${buffer.length} bytes)`);

  return { success: true };
};

export default fileArchiveExecutor;
