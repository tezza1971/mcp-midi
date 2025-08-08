// Simple client-side logger wrapper. Allows replacing implementation later (e.g. sending logs to main process or external service).
const prefix = '[renderer]';

function formatArgs(args: any[]) {
  return [prefix, ...args];
}

export default {
  info: (...args: any[]) => console.info(...formatArgs(args)),
  warn: (...args: any[]) => console.warn(...formatArgs(args)),
  error: (...args: any[]) => console.error(...formatArgs(args)),
  debug: (...args: any[]) => console.debug(...formatArgs(args)),
  log: (...args: any[]) => console.log(...formatArgs(args)),
};
