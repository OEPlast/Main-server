import winston, { createLogger, format, transports } from 'winston';

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

// Chose the aspect of your log customizing the log format.
export const formatter = format.combine(
  // Add the message timestamp with the preferred format
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  // Tell Winston that the logs must be colored
  winston.format.colorize({ all: true }),
  // Define the format of the message showing the timestamp, the level and the message
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

export const logger = createLogger({
  levels: customLevels.levels,
  // format: format.combine(
  //   format.colorize({ all: true }),
  //   format.timestamp(),
  //   format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
  // ),
  format: formatter,
  transports: [new transports.Console(), new transports.File({ filename: 'app.log' })],
});

winston.addColors(customLevels.colors);
