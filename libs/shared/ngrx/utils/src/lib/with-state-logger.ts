import { injectLogger } from '@cybertecpty/angular-utils';
import { signalStoreFeature, watchState, withHooks } from '@ngrx/signals';

/**
 * A feature to add logging capabilities to a signal store.
 *
 * State is logged as-is at `debug`, with no redaction. Do not use it on a store that holds secrets
 * or personal data if a transport that leaves the device is in use.
 * @param source The name of the store
 */
export function withStateLogger(source: string) {
  return signalStoreFeature(
    withHooks({
      onInit(store, logger = injectLogger(source)) {
        watchState(store, state => {
          logger.debug('[watchState]', state);
        });
      }
    })
  );
}
