'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

const LOG_DIR = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// logger loads before env validation, so fall back safely
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LOG_LEVELS = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };
const LOG_COLORS = { error: 'red', warn: 'yellow', info: 'green', http: 'magenta', debug: 'white' };

require('winston').addColors(LOG_COLORS);

const timestampFormat = format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' });

const prettyConsoleFormat = format.combine(
  format.colorize({ all: true }),
  timestampFormat,
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }),
);

const jsonFileFormat = format.combine(timestampFormat, format.errors({ stack: true }), format.json());

const logger = createLogger({
  levels: LOG_LEVELS,
  level: LOG_LEVEL,
  defaultMeta: { service: 'nexora-fashions-api' },
  transports: [
    new transports.Console({
      format: prettyConsoleFormat,
      silent: process.env.NODE_ENV === 'test',
    }),
    new transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: jsonFileFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: jsonFileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});

// stream interface for morgan HTTP request logging
logger.stream = {
  write(message) {
    logger.http(message.trim());
  },
};

module.exports = logger;
