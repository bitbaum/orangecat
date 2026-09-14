/**
 * PRODUCTION-SAFE LOGGER
 *
 * Replaces console.log statements with proper logging
 * that's safe for production use and provides structured logging.
 *
 * Created: 2025-06-30
 * Purpose: Eliminate console.log statements and provide structured logging
 */

// =====================================================================
// 🎯 LOGGER TYPES
// =====================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  source?: string;
}

// =====================================================================
// 🔧 LOGGER CONFIGURATION
// =====================================================================

const LOGGER_CONFIG = {
  // Only log errors and warnings in production
  productionLevel: 'warn' as LogLevel,

  // Log everything in development
  developmentLevel: 'debug' as LogLevel,

  // Get current environment
  get environment() {
    return process.env.NODE_ENV || 'development';
  },

  // Get active log level
  get activeLevel() {
    return this.environment === 'production' ? this.productionLevel : this.developmentLevel;
  },
};

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// =====================================================================
// 🔌 ERROR SINK (pluggable)
// =====================================================================
// Optional forward target for error-level logs. An integration (e.g. a
// self-hosted GlitchTip via @sentry/nextjs) registers via setErrorSink() once at
// startup; until then this is a no-op, so the logger stays dependency-free.
type ErrorSink = (entry: LogEntry) => void;
let errorSink: ErrorSink | null = null;

export function setErrorSink(sink: ErrorSink | null): void {
  errorSink = sink;
}

// =====================================================================
// 🔧 LOGGER IMPLEMENTATION
// =====================================================================

class Logger {
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[LOGGER_CONFIG.activeLevel as LogLevel];
  }

  private formatLogEntry(
    level: LogLevel,
    message: string,
    data?: unknown,
    source?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      source,
    };
  }

  private output(entry: LogEntry): void {
    const { timestamp, level, message, data, source } = entry;

    // In production, emit structured JSON to stdout/stderr so the systemd journal
    // (journald) captures a durable, queryable trail. shouldLog() has already
    // gated by activeLevel (warn+ in prod), so everything reaching here MUST be
    // emitted — previously only `error` was, silently dropping every warn.
    if (LOGGER_CONFIG.environment === 'production') {
      const line = JSON.stringify(entry);
      if (level === 'error') {
        console.error(line);
        // Forward to the error tracker when one is registered (see setErrorSink).
        try {
          errorSink?.(entry);
        } catch {
          // Never let error reporting break the request path.
        }
      } else {
        console.warn(line);
      }
      return;
    }

    // Development logging with colors and formatting
    const prefix = `[${timestamp}] ${level.toUpperCase()}`;
    const sourceInfo = source ? ` (${source})` : '';
    const payload = data !== undefined ? data : '';

    switch (level) {
      case 'debug':
        // eslint-disable-next-line no-console
        console.debug(prefix + sourceInfo + ':', message, payload);
        return;
      case 'info':
        // eslint-disable-next-line no-console
        console.info(prefix + sourceInfo + ':', message, payload);
        return;
      case 'warn':
        console.warn(prefix + sourceInfo + ':', message, payload);
        return;
      case 'error':
        console.error(prefix + sourceInfo + ':', message, payload);
        return;
    }
  }

  debug(message: string, data?: unknown, source?: string): void {
    if (!this.shouldLog('debug')) {
      return;
    }
    this.output(this.formatLogEntry('debug', message, data, source));
  }

  /**
   * `{ always: true }` is for an operational fact a MONITOR reads — a counter
   * or an outcome — and emits it whatever the level.
   *
   * The level exists to suppress chatty development output, not to suppress
   * numbers something outside the process depends on. Production sits at
   * `warn`, so platform-llm's "model call served" line shipped, passed CI, and
   * was INERT in production until a live journal read caught it: the sweep that
   * divides wins by losses could only ever see losses.
   *
   * An option rather than a new method on purpose — two dozen test files mock
   * this module by hand, and a method they do not know about is undefined at
   * the call site. Never use it for anything a user typed: this line is
   * guaranteed to be written down.
   */
  info(message: string, data?: unknown, source?: string, opts?: { always?: boolean }): void {
    if (!opts?.always && !this.shouldLog('info')) {
      return;
    }
    this.output(this.formatLogEntry('info', message, data, source));
  }

  warn(message: string, data?: unknown, source?: string): void {
    if (!this.shouldLog('warn')) {
      return;
    }
    this.output(this.formatLogEntry('warn', message, data, source));
  }

  error(message: string, data?: unknown, source?: string): void {
    if (!this.shouldLog('error')) {
      return;
    }
    this.output(this.formatLogEntry('error', message, data, source));
  }

  // Specialized logging methods
  supabase(message: string, data?: unknown): void {
    this.info(`[Supabase] ${message}`, data, 'supabase');
  }

  auth(message: string, data?: unknown): void {
    this.info(`[Auth] ${message}`, data, 'auth');
  }

  api(message: string, data?: unknown): void {
    this.info(`[API] ${message}`, data, 'api');
  }

  database(message: string, data?: unknown): void {
    this.info(`[Database] ${message}`, data, 'database');
  }

  performance(message: string, data?: unknown): void {
    this.debug(`[Performance] ${message}`, data, 'performance');
  }
}

// =====================================================================
// 🔧 SINGLETON EXPORT
// =====================================================================

export const logger = new Logger();

// =====================================================================
// 🔧 HELPER FUNCTIONS
// =====================================================================
