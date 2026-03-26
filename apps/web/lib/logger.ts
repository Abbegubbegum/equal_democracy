/**
 * Structured logger for Vercel/Next.js environment
 * Outputs JSON to stdout for easy parsing and filtering
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Set via LOG_LEVEL env var, defaults to 'info' in production, 'debug' in development
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ??
  (process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug);

function formatLog(level, context, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    ...data,
  };

  // In development, pretty print for readability
  if (process.env.NODE_ENV !== 'production') {
    return JSON.stringify(entry, null, 2);
  }

  return JSON.stringify(entry);
}

function shouldLog(level) {
  return LOG_LEVELS[level] <= currentLevel;
}

/**
 * Create a logger instance with a specific context
 * @param {string} context - The context/module name (e.g., 'Votes', 'Sessions', 'Auth')
 */
export function createLogger(context) {
  return {
    error(message, data = {}) {
      if (shouldLog('error')) {
        console.error(formatLog('error', context, message, data));
      }
    },

    warn(message, data = {}) {
      if (shouldLog('warn')) {
        console.warn(formatLog('warn', context, message, data));
      }
    },

    info(message, data = {}) {
      if (shouldLog('info')) {
        console.log(formatLog('info', context, message, data));
      }
    },

    debug(message, data = {}) {
      if (shouldLog('debug')) {
        console.log(formatLog('debug', context, message, data));
      }
    },
  };
}

// Default logger for quick one-off usage
export const logger = createLogger('App');
