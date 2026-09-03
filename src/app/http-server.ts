import { loadEnvironment } from '../config/environment';
import { composeApp } from './composition-root';

function main(): void {
  let config;
  try {
    config = loadEnvironment();
  } catch (err) {
    // Logger does not exist yet — configuration failed before it could be built.
    // eslint-disable-next-line no-console
    console.error('Failed to start: invalid environment configuration.', err);
    process.exit(1);
  }

  const { app, logger } = composeApp(config);

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, nodeEnv: config.nodeEnv }, 'Server listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down');
    server.close((err) => {
      if (err) {
        logger.error({ err }, 'Error while shutting down');
        process.exitCode = 1;
      }
      process.exit();
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
