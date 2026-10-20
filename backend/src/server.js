import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config/index.js';

async function bootstrap() {
  try {
    console.log(`Connecting to MongoDB at ${config.mongoUri}...`);
    await mongoose.connect(config.mongoUri);
    console.log('✓ Successfully connected to MongoDB.');

    const app = createApp();

    const server = app.listen(config.port, config.host, () => {
      console.log(`
=============================================================
  Etimad Suit Authoritative SaaS Backend Running!
  Environment : ${config.env}
  Port        : ${config.port}
  Health check: http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}/health
=============================================================
      `);
    });

    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await mongoose.connection.close();
        console.log('Server and database connections closed. Bye!');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Fatal error during backend startup:', error);
    process.exit(1);
  }
}

bootstrap();

