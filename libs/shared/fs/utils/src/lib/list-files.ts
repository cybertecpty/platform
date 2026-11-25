import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lists every file under `folder` on the real file system, recursively, as paths relative
 * to `folder`: forward-slashed on every platform, sorted, directories left out.
 */
export const listFiles = (folder: string): string[] =>
  readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .map(entry => entry.replaceAll('\\', '/'))
    .filter(entry => statSync(join(folder, entry)).isFile())
    .sort();
