const { PrismaClient } = require('@prisma/client');
const logger = require('./config/pinoLogger');

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'info', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
    { level: 'error', emit: 'stdout' },
  ],
});

prisma.$on('query', (e) => {
  logger.debug(`Query: ${e.query}`);
  logger.debug(`Params: ${e.params}`);
  logger.debug(`Duration: ${e.duration}ms`);
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('PostgreSQL connected via Prisma');
  } catch (error) {
    logger.error('PostgreSQL connection error:', error);
    // In dev mode, we might want to continue even if DB is down if we have fallback logic
    if (process.env.NODE_ENV === 'production') {
       process.exit(1);
    }
  }
};

module.exports = { prisma, connectDB };
