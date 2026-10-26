import {
  ComboSourceTagConstraint,
  DependencyConstraint,
  SingleSourceTagConstraint
} from '@cybertecpty/nx-types';
import { ProjectGraphProjectNode } from '@nx/devkit';
import { hasProjectTag } from './nx-project-tags.utils';

/**
 * Reports each pattern in `bannedTags` that matches one of the target's tags.
 *
 * @param sourceTagLabel - The broken constraint's source tag, as it appears in the message.
 * @param targetTags - The tags of the project being depended on.
 * @param bannedTags - Tag patterns the source must not depend on.
 * @returns One message per banned pattern that the target matches.
 */
export function checkBannedTagsViolations(
  sourceTagLabel: string,
  targetTags: readonly string[],
  bannedTags: readonly string[]
): string[] {
  const violations: string[] = [];

  for (const bannedTag of bannedTags) {
    if (hasProjectTag(targetTags, bannedTag)) {
      violations.push(
        `A project tagged with "${sourceTagLabel}" can not depend on libs tagged with "${bannedTag}"`
      );
    }
  }

  return violations;
}

/**
 * Checks one dependency, from `source` to `target`, against the dependency constraints.
 *
 * Every constraint whose source tags the source project has applies. The target must have at
 * least one of the constraint's `onlyDependOnLibsWithTags` and none of its
 * `notDependOnLibsWithTags`. A source that no constraint applies to is itself a violation, as it
 * is for `@nx/enforce-module-boundaries`.
 *
 * @returns One message per broken rule, each starting with `source -> target:` so it names the
 * dependency it is about, or an empty array if the dependency is allowed.
 */
export function checkDepConstraints(
  source: ProjectGraphProjectNode,
  target: ProjectGraphProjectNode,
  constraints: ReadonlyArray<DependencyConstraint>
): string[] {
  const srcTags = source.data.tags ?? [];
  const targetTags = target.data.tags ?? [];

  const violations: string[] = [];
  let sourceMatchedAConstraint = false;

  for (const constraint of constraints) {
    if (!srcTagsMatchConstraint(srcTags, constraint)) {
      continue;
    }

    sourceMatchedAConstraint = true;

    const sourceTagLabel = getSourceTagLabel(constraint);

    if (constraint.onlyDependOnLibsWithTags) {
      violations.push(
        ...checkExpectedTagsViolations(
          sourceTagLabel,
          targetTags,
          constraint.onlyDependOnLibsWithTags
        )
      );
    }

    if (constraint.notDependOnLibsWithTags) {
      violations.push(
        ...checkBannedTagsViolations(sourceTagLabel, targetTags, constraint.notDependOnLibsWithTags)
      );
    }
  }

  if (!sourceMatchedAConstraint) {
    violations.push(
      'A project without tags matching at least one constraint cannot depend on any libraries'
    );
  }

  return violations.map(violation => `${source.name} -> ${target.name}: ${violation}`);
}

/**
 * Checks that the target has at least one of the expected tag patterns.
 *
 * An empty `expectedTags` means the source may depend on no tagged project at all, so a target
 * that has any tags is a violation.
 *
 * @param sourceTagLabel - The broken constraint's source tag, as it appears in the message.
 * @param targetTags - The tags of the project being depended on.
 * @param expectedTags - Tag patterns of which the target must match at least one.
 * @returns A single message if the target matches none of them, otherwise an empty array.
 */
export function checkExpectedTagsViolations(
  sourceTagLabel: string,
  targetTags: readonly string[],
  expectedTags: readonly string[]
): string[] {
  if (expectedTags.length === 0) {
    return targetTags.length > 0
      ? [`A project tagged with "${sourceTagLabel}" cannot depend on any libs with tags`]
      : [];
  }

  if (expectedTags.some(expectedTag => hasProjectTag(targetTags, expectedTag))) {
    return [];
  }

  return [
    `A project tagged with "${sourceTagLabel}" can only depend on libs tagged with ${stringifyTags(expectedTags)}`
  ];
}

/**
 * Whether `constraint` applies to projects that have all of several source tags (`allSourceTags`),
 * as opposed to one source tag.
 */
export function isComboSrcTagConstraint(
  constraint: DependencyConstraint
): constraint is ComboSourceTagConstraint {
  return 'allSourceTags' in constraint;
}

/**
 * Whether `constraint` applies to projects that have one source tag (`sourceTag`), as opposed to
 * several (`allSourceTags`).
 */
export function isSingleSrcTagConstraint(
  constraint: DependencyConstraint
): constraint is SingleSourceTagConstraint {
  return 'sourceTag' in constraint;
}

/**
 * The source tag(s) of a constraint as they appear in a message. A combo constraint lists all of
 * its tags, joined so that they read `"a" and "b"` once the caller wraps the label in quotes.
 */
function getSourceTagLabel(constraint: DependencyConstraint): string {
  return isComboSrcTagConstraint(constraint)
    ? constraint.allSourceTags.join('" and "')
    : constraint.sourceTag;
}

/**
 * Whether the source project's tags satisfy a constraint's source tags: the single source tag for
 * a plain constraint, or every one of `allSourceTags` for a combo constraint. Tag patterns follow
 * `hasProjectTag`, so wildcards are allowed.
 */
function srcTagsMatchConstraint(
  srcTags: readonly string[],
  constraint: DependencyConstraint
): boolean {
  return isComboSrcTagConstraint(constraint)
    ? constraint.allSourceTags.every(tag => hasProjectTag(srcTags, tag))
    : hasProjectTag(srcTags, constraint.sourceTag);
}

/**
 * Quotes each tag and joins them with commas, such as `"type:api", "type:utils"`, for use in a
 * violation message.
 */
function stringifyTags(tags: readonly string[]): string {
  return tags.map(tag => `"${tag}"`).join(', ');
}
