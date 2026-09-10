const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel = process.env.LOG_LEVEL || 'info';

function write(level, message, details) {
  if (levels[level] < (levels[configuredLevel] ?? levels.info)) return;
  const suffix = details === undefined ? '' : ` ${JSON.stringify(details)}`;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${suffix}`;
  (level === 'error' ? console.error : console.log)(line);
}

export const logger = {
  debug: (message, details) => write('debug', message, details),
  info: (message, details) => write('info', message, details),
  warn: (message, details) => write('warn', message, details),
  error: (message, details) => write('error', message, details)
};
