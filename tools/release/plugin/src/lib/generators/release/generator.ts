import { formatFiles, logger, type Tree } from '@nx/devkit';
import type { ReleaseGeneratorOptions } from './schema';

/**
 * TODO: describe what the `release` generator scaffolds.
 */
export async function releaseGenerator(
  tree: Tree,
  options: ReleaseGeneratorOptions
): Promise<void> {
  logger.info(`TODO: implement the "${options.name}" generator`);

  await formatFiles(tree);
}

export default releaseGenerator;
