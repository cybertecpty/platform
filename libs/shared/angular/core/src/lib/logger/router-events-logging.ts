import { DestroyRef, inject, provideEnvironmentInitializer } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
  type Event as RouterEvent
} from '@angular/router';
import { Logger } from '@cybertecpty/logging-utils';
import { type LoggerFeature, LoggerFeatureKind } from './logger-feature';

export type RouterEventsLoggingFeature = LoggerFeature<LoggerFeatureKind.RouterEventsLogging>;

/**
 * Logs router navigation events under the `router-navigation` scope: start and end at `info`,
 * a cancelled navigation at `warn`, a failed one at `error` and a skipped one at `debug`.
 * Adding it twice logs every event twice.
 */
export function withRouterEventsLogging(): RouterEventsLoggingFeature {
  return {
    kind: LoggerFeatureKind.RouterEventsLogging,
    providers: [
      provideEnvironmentInitializer(() => {
        subscribeToRouterNavigation(
          inject(Logger),
          inject(Router, { optional: true }),
          inject(DestroyRef)
        );
      })
    ]
  };
}

function logRouterNavigationEvent(logger: Logger, event: RouterEvent): void {
  if (event instanceof NavigationStart) {
    logger.info('NavigationStart', { id: event.id, url: event.url });
    return;
  }

  if (event instanceof NavigationEnd) {
    logger.info('NavigationEnd', {
      id: event.id,
      url: event.url,
      urlAfterRedirects: event.urlAfterRedirects
    });
    return;
  }

  if (event instanceof NavigationCancel) {
    logger.warn('NavigationCancel', {
      code: event.code,
      id: event.id,
      reason: event.reason,
      url: event.url
    });
    return;
  }

  if (event instanceof NavigationError) {
    logger.error('NavigationError', {
      error: event.error as Error,
      id: event.id,
      url: event.url
    });
    return;
  }

  if (event instanceof NavigationSkipped) {
    logger.debug('NavigationSkipped', {
      code: event.code,
      id: event.id,
      reason: event.reason,
      url: event.url
    });
  }
}

function subscribeToRouterNavigation(
  logger: Logger,
  router: Router | null,
  destroyRef: DestroyRef
): void {
  if (!router) {
    return;
  }

  const navigationLogger = logger.extendScope('router-navigation');

  router.events.pipe(takeUntilDestroyed(destroyRef)).subscribe(event => {
    logRouterNavigationEvent(navigationLogger, event);
  });
}
