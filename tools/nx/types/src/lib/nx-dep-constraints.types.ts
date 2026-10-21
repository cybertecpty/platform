/**
 * Defines a constraint for multiple source tags.
 */
export type ComboSourceTagConstraint = {
  allSourceTags: string[];
  onlyDependOnLibsWithTags?: string[];
  notDependOnLibsWithTags?: string[];
  allowedExternalImports?: string[];
  bannedExternalImports?: string[];
};

/**
 * Defines a dependency constraint for Nx projects, which can be either a single source tag constraint
 * or a combo source tag constraint.
 * This is used to enforce rules on how projects can depend on each other based on their tags.
 */
export type DepConstraint = SingleSourceTagConstraint | ComboSourceTagConstraint;

/**
 * Defines a constraint for a single source tag.
 */
export type SingleSourceTagConstraint = {
  sourceTag: string;
  onlyDependOnLibsWithTags?: string[];
  notDependOnLibsWithTags?: string[];
  allowedExternalImports?: string[];
  bannedExternalImports?: string[];
};
