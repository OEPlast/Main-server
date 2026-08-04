import fs from 'fs';
import path from 'path';
import winston, { format, transports } from 'winston';

const customLevels = {
  levels: {
    critical: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    http: 5,
  },
  colors: {
    critical: 'red',
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    http: 'magenta',
  },
};

winston.addColors(customLevels.colors);

const formatter = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  format.colorize({ all: true }),
  format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

export const logger = winston.createLogger({
  levels: customLevels.levels,
  format: formatter,
  transports: [new transports.Console()],
});

/**
 * HTTP access log — a separate, queryable sink.
 *
 * `logger` above writes to the console only, so whether request records survive
 * depends entirely on what the host does with stdout. Retiring the legacy
 * analytics endpoints requires positive evidence that nothing outside the admin
 * app calls them, and that evidence has to be greppable weeks after the fact —
 * hence a dedicated rotating file of JSON lines rather than console output.
 *
 * 20 MB × 10 files comfortably covers the multi-week window at current traffic.
 * The message is already a JSON string built by the morgan formatter, so the
 * format here is a passthrough — wrapping it in winston's own JSON envelope
 * would nest one JSON document inside another.
 */
export const ACCESS_LOG_DIR = path.resolve(process.cwd(), 'logs');

fs.mkdirSync(ACCESS_LOG_DIR, { recursive: true });

export const accessLogger = winston.createLogger({
  levels: { http: 0 },
  level: 'http',
  format: format.printf((info) => String(info.message)),
  transports: [
    new transports.File({
      filename: path.join(ACCESS_LOG_DIR, 'access.log'),
      maxsize: 20 * 1024 * 1024,
      maxFiles: 10,
      tailable: true,
    }),
  ],
});
