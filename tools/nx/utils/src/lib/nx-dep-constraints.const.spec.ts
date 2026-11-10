import { DEP_CONSTRAINTS } from './nx-dep-constraints.const.mjs';
import { isSingleSrcTagConstraint } from './nx-dep-constraints.utils';

const findRow = (sourceTag: string) =>
  DEP_CONSTRAINTS.find(
    constraint => isSingleSrcTagConstraint(constraint) && constraint.sourceTag === sourceTag
  );

describe('DEP_CONSTRAINTS', () => {
  describe('the type:ui row', () => {
    it('bans the Angular HTTP entry point', () => {
      expect(findRow('type:ui')?.bannedExternalImports).toContain('@angular/common/http');
    });

    it('leaves the entry point open to type:data-access', () => {
      const row = findRow('type:data-access');

      expect(row).toBeDefined();
      expect(row?.bannedExternalImports ?? []).not.toContain('@angular/common/http');
    });
  });
});
