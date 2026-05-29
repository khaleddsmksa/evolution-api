/**
 * أداة تسجيل بسيطة مع ألوان وطوابع زمنية.
 */
const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function timestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function format(level, color, args) {
  const ts = `${colors.gray}[${timestamp()}]${colors.reset}`;
  const tag = `${color}${level.padEnd(5)}${colors.reset}`;
  return [ts, tag, ...args];
}

export const logger = {
  info: (...args) => console.log(...format('INFO', colors.cyan, args)),
  success: (...args) => console.log(...format('OK', colors.green, args)),
  warn: (...args) => console.warn(...format('WARN', colors.yellow, args)),
  error: (...args) => console.error(...format('ERROR', colors.red, args)),
  debug: (...args) => {
    if (process.env.DEBUG) console.log(...format('DEBUG', colors.magenta, args));
  },
};

export default logger;
