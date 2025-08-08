/* Simple logger wrapper that uses pino when available, otherwise falls back to console. */

let logger: any;

try {
  // Use dynamic require so TypeScript won't fail at compile time if pino isn't installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
  const pino = require('pino');
  logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
} catch (e) {
  // Fallback to a console-based logger
  logger = {
    info: (...args: any[]) => console.log('[info]', ...args),
    warn: (...args: any[]) => console.warn('[warn]', ...args),
    error: (...args: any[]) => console.error('[error]', ...args),
    debug: (...args: any[]) => console.debug('[debug]', ...args)
  } as any;
}

export default logger;
