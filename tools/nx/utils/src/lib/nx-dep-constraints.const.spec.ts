import { DEP_CONSTRAINTS } from './nx-dep-constraints.const.mjs';
import { isSingleSrcTagConstraint } from './nx-dep-constraints.utils';

const ANGULAR_HTTP_ENTRY_POINT = '@angular/common/http';

const findRow = (sourceTag: string) =>
  DEP_CONSTRAINTS.find(
    constraint => isSingleSrcTagConstraint(constraint) && constraint.sourceTag === sourceTag
  );

describe('DEP_CONSTRAINTS', () => {
  describe('the Angular HTTP entry point ban', () => {
    // A row on the bare tag binds a lib of every scope, so a `scope:shared` util is covered too.
    it.each(['type:ui', 'type:utils', 'type:types'])(
      'is on the %s row, whatever the lib scope',
      sourceTag => {
        expect(findRow(sourceTag)?.bannedExternalImports).toContain(ANGULAR_HTTP_ENTRY_POINT);
      }
    );

    // `type:testing` libs may build an `HttpClient` stub, and `type:data-access` is where the
    // transport belongs.
    it.each(['type:testing', 'type:data-access'])('is not on the %s row', sourceTag => {
      const row = findRow(sourceTag);

      expect(row).toBeDefined();
      expect(row?.bannedExternalImports ?? []).not.toContain(ANGULAR_HTTP_ENTRY_POINT);
    });
  });
});
