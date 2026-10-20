import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';

let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  if (!config.mongoUri) {
    console.warn('[Vercel Serverless] MONGODB_URI is not set. Database operations may fail.');
    return null;
  }
  
  cachedConnection = await mongoose.connect(config.mongoUri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
  });
  return cachedConnection;
}

const app = createApp();

export default async function handler(req, res) {
  try {
    await connectToDatabase();
  } catch (err) {
    console.error('[Vercel Serverless] MongoDB connection error:', err.message);
  }
  return app(req, res);
}
