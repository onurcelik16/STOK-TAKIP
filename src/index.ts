import 'dotenv/config';
process.env.TZ = 'Europe/Istanbul';
import { createServer } from './server/app';
import { ensureDatabaseInitialized } from './server/data/db';
import { scheduleStockChecks } from './server/jobs/checkStock';
import { startTelegramBot } from './server/services/telegramBot';
import { logger } from './server/utils/logger';

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection at Promise');
});

process.on('uncaughtException', (err) => {
  logger.error(err, 'Uncaught Exception thrown');
  process.exit(1);
});

async function main() {
  logger.info('Starting application...');

  try {
    ensureDatabaseInitialized();
    logger.info('Database initialized successfully');
  } catch (err) {
    logger.error(err, 'Failed to initialize database');
    process.exit(1);
  }

  const app = createServer();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  app.listen(port, '0.0.0.0', () => {
    logger.info(`[api] server running at http://0.0.0.0:${port}`);
    console.log(`SERVER_READY_ON_PORT_${port}`); // Railway/Docker logs for visibility
  });

  scheduleStockChecks();
  startTelegramBot();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});



