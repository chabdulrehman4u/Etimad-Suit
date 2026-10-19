import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '0.0.0.0',
  appName: process.env.APP_NAME || 'Etimad Suit',
  platformDomain: process.env.PLATFORM_DOMAIN || 'etimadsuit.com',
  
  // Database
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/etimad_suit_dev',
  
  // Security & JWT
  jwtSecret: process.env.JWT_SECRET || 'dev_insecure_jwt_secret_etimad_suit_2026_super_safe_64_bytes_minimum',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: 'etimad_token',
  cookieSecret: process.env.COOKIE_SECRET || 'dev_cookie_signing_secret_etimad_2026',
  
  // Allowed CORS Origins
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) : [])
  ].filter(Boolean)
};

export default config;

