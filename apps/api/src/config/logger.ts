import winston from 'winston';

const env = process.env.NODE_ENV || 'development';

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

export const logger = winston.createLogger({
  level: env === 'production' ? 'info' : 'debug',
  format,
  transports,
});
