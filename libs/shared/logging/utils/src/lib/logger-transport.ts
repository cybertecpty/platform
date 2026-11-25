import createDebug, { type Debugger } from 'debug';
import { LOG_NAMESPACE_SEPARATOR, type LogLevel } from './logger';

export interface LogTransport {
  /**
   * Enable all logging for this transport.
   */
  enableAll(): void;
  /**
   * Initializes the transport by creating, but without enabling,
   * logger instances for the given namespace and levels.
   */
  initialize(namespace: string, levels: readonly LogLevel[]): void;
  /**
   * Check if logging is enabled for the given namespace and level.
   */
  isEnabled(namespace: string, level: LogLevel): boolean;
  /**
   * Log a message for the given namespace at the specified level.
   */
  log: (namespace: string, level: LogLevel, ...args: unknown[]) => void;
}

/**
 * Levels a `ConsoleTransport` logs without being enabled through `DEBUG`: a hidden
 * warning or error is a failure that passes silently.
 */
export const DEFAULT_ALWAYS_ENABLED_LEVELS: readonly LogLevel[] = ['warn', 'error'];

export interface ConsoleTransportOptions {
  /**
   * Levels that are logged whether or not `DEBUG` enables them.
   * Pass an empty array to make every level opt-in.
   * @default DEFAULT_ALWAYS_ENABLED_LEVELS
   */
  alwaysEnabled?: readonly LogLevel[];
}

/**
 * A log transport that can be used to log messages to the console.
 * It uses the `debug` library to create loggers for each namespace and log level.
 */
export class ConsoleTransport implements LogTransport {
  protected readonly loggers = new Map<string, Debugger>();

  protected readonly alwaysEnabled: readonly LogLevel[];

  protected allEnabled = false;

  constructor(options: ConsoleTransportOptions = {}) {
    this.alwaysEnabled = options.alwaysEnabled ?? DEFAULT_ALWAYS_ENABLED_LEVELS;
  }

  protected createLogger(namespace: string, level: LogLevel): Debugger {
    const fullNamespace = this.fullNamespace(namespace, level);
    const logger = createDebug(fullNamespace);

    // Bind the logger to the corresponding console method.
    // This allows us to filter the logs in the browser console
    // by their log level. The method is looked up on each call, so a console
    // patched or spied on after creation is still honoured.
    logger.log = (...args: unknown[]) => {
      console[level](...args);
    };

    if (this.allEnabled || this.alwaysEnabled.includes(level)) {
      logger.enabled = true;
    }

    this.loggers.set(fullNamespace, logger);

    return logger;
  }

  enableAll(): void {
    this.allEnabled = true;
    this.loggers.forEach(logger => {
      logger.enabled = true;
    });
  }

  protected fullNamespace(namespace: string, level: LogLevel): string {
    return `${namespace}${LOG_NAMESPACE_SEPARATOR}${level}`;
  }

  initialize(namespace: string, levels: readonly LogLevel[]): void {
    levels.forEach(level => {
      // A namespace can be initialized more than once (each extendScope call
      // does), so reuse existing loggers instead of replacing them.
      this.getOrCreateLogger(namespace, level);
    });
  }

  protected getOrCreateLogger(namespace: string, level: LogLevel): Debugger {
    const fullNamespace = this.fullNamespace(namespace, level);
    const logger = this.loggers.get(fullNamespace) || this.createLogger(namespace, level);

    return logger;
  }

  isEnabled(namespace: string, level: LogLevel): boolean {
    const logger = this.getOrCreateLogger(namespace, level);
    return logger.enabled;
  }

  log(namespace: string, level: LogLevel, ...args: unknown[]): void {
    if (args.length === 0) {
      return;
    }

    const logger = this.getOrCreateLogger(namespace, level);
    const [formatter, ...restArgs] = args;

    logger(formatter, ...restArgs);
  }
}

/**
 * A log transport that discards everything. Use it where a logger is required
 * but output is not wanted, such as in tests or when logging is turned off.
 */
export class NoopTransport implements LogTransport {
  enableAll(): void {
    // No-op
  }
  initialize(): void {
    // No-op
  }
  isEnabled(): boolean {
    return false;
  }
  log(): void {
    // No-op
  }
}
