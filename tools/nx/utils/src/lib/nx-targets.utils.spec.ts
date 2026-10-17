import type { ProjectGraph, TargetConfiguration } from '@nx/devkit';
import { resolveTargetOutputFolder } from './nx-targets.utils';

/** A project graph with one project, `site`, that has the given targets. */
const createGraph = (targets: Record<string, TargetConfiguration>): ProjectGraph => ({
  nodes: {
    site: { name: 'site', type: 'app', data: { root: 'apps/site', targets } }
  },
  dependencies: {}
});

describe('resolveTargetOutputFolder', () => {
  it("returns the target's single output with workspace placeholders filled in", () => {
    const graph = createGraph({ build: { outputs: ['{workspaceRoot}/dist/{projectRoot}'] } });

    expect(resolveTargetOutputFolder(graph, 'site', 'build')).toBe('dist/apps/site');
  });

  it("resolves option placeholders with the target's default configuration", () => {
    const graph = createGraph({
      build: {
        outputs: ['{options.outputPath}'],
        options: { outputPath: 'dist/development' },
        configurations: { production: { outputPath: 'dist/production' } },
        defaultConfiguration: 'production'
      }
    });

    expect(resolveTargetOutputFolder(graph, 'site', 'build')).toBe('dist/production');
  });

  it('reads the named target, not only build', () => {
    const graph = createGraph({ 'build-static': { outputs: ['{workspaceRoot}/dist/static'] } });

    expect(resolveTargetOutputFolder(graph, 'site', 'build-static')).toBe('dist/static');
  });

  it('throws when the project is not in the graph', () => {
    expect(() => resolveTargetOutputFolder(createGraph({}), 'missing', 'build')).toThrow(
      'missing is not in the project graph.'
    );
  });

  it('throws when the project has no such target', () => {
    expect(() => resolveTargetOutputFolder(createGraph({}), 'site', 'build')).toThrow(
      'site has no "build" target.'
    );
  });

  it.each<[string, TargetConfiguration]>([
    ['no outputs', {}],
    ['an empty outputs list', { outputs: [] }]
  ])('throws when the target declares %s', (_label, build) => {
    expect(() => resolveTargetOutputFolder(createGraph({ build }), 'site', 'build')).toThrow(
      'site:build declares no outputs, so its output folder is unknown.'
    );
  });

  it.each<[string, string[], string]>([
    [
      'several outputs',
      ['{workspaceRoot}/dist/a', '{workspaceRoot}/coverage/a'],
      '["dist/a","coverage/a"]'
    ],
    ['a glob', ['{workspaceRoot}/dist/{projectRoot}/**'], '["dist/apps/site/**"]']
  ])('throws when the target declares %s', (_label, outputs, resolved) => {
    expect(() =>
      resolveTargetOutputFolder(createGraph({ build: { outputs } }), 'site', 'build')
    ).toThrow(`site:build must declare exactly one output folder, but resolves to ${resolved}.`);
  });
});
