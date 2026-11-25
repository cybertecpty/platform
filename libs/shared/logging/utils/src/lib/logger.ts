import { kebabCase } from 'lodash-es';
import type { LogTransport } from './logger-transport';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Array of all supported log levels.
 */
export const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

/**
 * Separator used between namespace segments.
 */
export const LOG_NAMESPACE_SEPARATOR = ':';

/**
 * Logger class that provides methods for logging messages at different levels (debug, info, warn, error).
 * It uses an array of LogTransport instances to handle the actual logging logic.
 */
export class Logger {
  constructor(
    readonly namespace: string,
    readonly transports: readonly LogTransport[],
    readonly levels = LOG_LEVELS
  ) {
    transports.forEach(transport => {
      transport.initialize(namespace, levels);
    });
  }

  /**
   * Emits a debug level log message.
   */
  debug(...args: unknown[]): void {
    this.emit('debug', ...args);
  }

  /**
   * Instructs each transport to log a message at the specified level.
   * Levels this logger was not created with are dropped.
   * @param level The log level.
   * @param args The arguments to log.
   */
  protected emit(level: LogLevel, ...args: unknown[]) {
    if (!this.levels.includes(level)) {
      return;
    }

    this.transports.forEach(transport => transport.log(this.namespace, level, ...args));
  }

  /**
   * Emits an error level log message.
   */
  error(...args: unknown[]): void {
    this.emit('error', ...args);
  }

  /**
   * Creates a new Logger instance with an extended namespace.
   * @param suffix One static scope name, such as `Invoice`. It is kebab-cased, so it cannot carry
   * a `:`; call `extendScope` once per segment. Don't pass an id, because each scope keeps its
   * own loggers for the life of the transport.
   * @returns A new Logger instance with the extended namespace.
   */
  extendScope(suffix: string): Logger {
    const scope = kebabCase(suffix);
    return new Logger(
      [this.namespace, scope].join(LOG_NAMESPACE_SEPARATOR),
      this.transports,
      this.levels
    );
  }

  /**
   * Emits an info level log message.
   */
  info(...args: unknown[]): void {
    this.emit('info', ...args);
  }

  /**
   * Checks whether a message at the given level would be logged, so a caller can
   * skip building expensive arguments. A level this logger was not created with is
   * never enabled.
   * @param level The log level.
   */
  isEnabled(level: LogLevel): boolean {
    return (
      this.levels.includes(level) &&
      this.transports.some(transport => transport.isEnabled(this.namespace, level))
    );
  }

  /**
   * Emits a warn level log message.
   */
  warn(...args: unknown[]): void {
    this.emit('warn', ...args);
  }
}
