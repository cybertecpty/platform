import { injectLogger } from '@cybertecpty/angular-utils';
import { signalStoreFeature, watchState, withHooks } from '@ngrx/signals';

/** Replaces the value of a masked state field in the logged state. */
export const REDACTED = '[REDACTED]';

export interface StateLoggerOptions {
  /** Top-level state fields left out of the logged state. */
  omit?: readonly string[];
  /** Top-level state fields whose value is replaced with `[REDACTED]` in the logged state. */
  mask?: readonly string[];
}

/**
 * A feature to add logging capabilities to a signal store.
 *
 * State is logged at `debug`. Fields named in `omit` are dropped and fields named in `mask` show
 * `[REDACTED]`, before the state reaches the logger. Only top-level fields are matched, and a store
 * that declares nothing logs its whole state.
 * @param source The name of the store
 * @param options The state fields to omit or mask
 */
export function withStateLogger(source: string, options: StateLoggerOptions = {}) {
  const { omit = [], mask = [] } = options;

  const redact = (state: object): object =>
    Object.fromEntries(
      Object.entries(state)
        .filter(([key]) => !omit.includes(key))
        .map(([key, value]) => [key, mask.includes(key) ? REDACTED : value])
    );

  return signalStoreFeature(
    withHooks({
      onInit(store, logger = injectLogger(source)) {
        watchState(store, state => {
          logger.debug('[watchState]', redact(state));
        });
      }
    })
  );
}
