import { DestroyRef, inject, provideEnvironmentInitializer } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Logger } from '@cybertecpty/logging-utils';
import { Events } from '@ngrx/signals/events';
import { type SignalStoreFeature, SignalStoreFeatureKind } from './signal-store-feature';

export type EventsLogging = SignalStoreFeature<SignalStoreFeatureKind.EventsLogging>;

export function withEventsLogging(): EventsLogging {
  return {
    kind: SignalStoreFeatureKind.EventsLogging,
    providers: [
      provideEnvironmentInitializer(() => {
        subscribeToStoreEvents(inject(Logger), inject(Events), inject(DestroyRef));
      })
    ]
  };
}

function subscribeToStoreEvents(logger: Logger, events: Events, destroyRef: DestroyRef): void {
  const eventsLogger = logger.extendScope('store-events');

  events
    .on()
    .pipe(takeUntilDestroyed(destroyRef))
    .subscribe(event => {
      eventsLogger.info(`${event.type}`, event.payload);
    });
}
