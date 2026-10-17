/** The slice of `tsconfig.base.json` the generator test artifacts read and write. */
export interface TsConfigBase {
  compilerOptions?: { paths?: Record<string, string[]> };
}
