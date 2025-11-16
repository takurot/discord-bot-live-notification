import { createLogger, format, transports } from 'winston';

const nodeEnv = process.env.NODE_ENV || 'development';
const defaultLevel = nodeEnv === 'development' ? 'debug' : 'info';
const logLevel = process.env.LOG_LEVEL || defaultLevel;

export const logger = createLogger({
  level: logLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'streampulse-bot' },
  transports: [
    new transports.Console({
      handleExceptions: true,
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      ),
    }),
  ],
});

if (process.env.NODE_ENV === 'production') {
  logger.add(
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
    })
  );
  logger.add(
    new transports.File({
      filename: 'logs/combined.log',
    })
  );
}
