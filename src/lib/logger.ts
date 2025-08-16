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
