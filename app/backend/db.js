const { PrismaClient } = require('./prisma/generated/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const logger = require('./config/pinoLogger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
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
    logger.info('PostgreSQL connected via Prisma 7 Driver Adapter');
  } catch (error) {
    logger.error('PostgreSQL connection error:', error);
    if (process.env.NODE_ENV === 'production') {
       process.exit(1);
    }
  }
};

module.exports = { prisma, connectDB };
