import { addProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { assertOwningApp } from './assert-owning-app';

describe('assertOwningApp', () => {
  function createAppTreeFixture() {
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'cybertec-io', {
      root: 'apps/cybertec-io',
      tags: ['domain:cybertec-io', 'platform:frontend', 'type:app']
    });
    addProjectConfiguration(tree, 'billing-ui', {
      root: 'libs/billing/ui',
      tags: ['domain:billing', 'platform:frontend', 'type:ui']
    });

    return tree;
  }

  it('does nothing when the project names no app', () => {
    expect(() =>
      assertOwningApp(createAppTreeFixture(), {
        domain: 'billing',
        platform: 'frontend',
        type: 'ui'
      })
    ).not.toThrow();
  });

  it('accepts a lib of the same platform as its app', () => {
    expect(() =>
      assertOwningApp(createAppTreeFixture(), {
        app: 'cybertec-io',
        domain: 'billing',
        platform: 'frontend',
        type: 'ui'
      })
    ).not.toThrow();
  });

  it('accepts a `platform:shared` lib, which every app can use', () => {
    expect(() =>
      assertOwningApp(createAppTreeFixture(), {
        app: 'cybertec-io',
        domain: 'billing',
        platform: 'shared',
        type: 'types'
      })
    ).not.toThrow();
  });

  it('rejects `app` with the `shared` domain before looking the app up', () => {
    expect(() =>
      assertOwningApp(createAppTreeFixture(), {
        app: 'missing',
        domain: 'shared',
        platform: 'frontend',
        type: 'ui'
      })
    ).toThrow('`app` cannot be set for the `shared` domain');
  });

  it('throws when the app does not exist', () => {
    expect(() =>
      assertOwningApp(createAppTreeFixture(), {
        app: 'missing',
        domain: 'billing',
        platform: 'frontend',
        type: 'ui'
      })
    ).toThrow('`app` "missing" is not a project in this workspace.');
  });

  it('throws when the project is not an app', () => {
    expect(() =>
      assertOwningApp(createAppTreeFixture(), {
        app: 'billing-ui',
        domain: 'billing',
        platform: 'frontend',
        type: 'ui'
      })
    ).toThrow('`app` "billing-ui" is not tagged `type:app`.');
  });

  it('throws when the lib and its app are on different platforms', () => {
    expect(() =>
      assertOwningApp(createAppTreeFixture(), {
        app: 'cybertec-io',
        domain: 'billing',
        platform: 'backend',
        type: 'types'
      })
    ).toThrow(
      'A `platform:backend` lib cannot belong to `cybertec-io`, a `platform:frontend` app.'
    );
  });
});
