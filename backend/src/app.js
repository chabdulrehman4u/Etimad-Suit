import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config/index.js';

// Route imports
import authRoutes from './modules/auth/authRoutes.js';
import tenantRoutes from './modules/tenants/tenantRoutes.js';
import productRoutes from './modules/products/productRoutes.js';
import inventoryRoutes from './modules/inventory/inventoryRoutes.js';
import orderRoutes from './modules/orders/orderRoutes.js';
import storefrontRoutes from './modules/storefront/storefrontRoutes.js';
import purchaseRoutes from './modules/purchases/purchaseRoutes.js';
import financeRoutes from './modules/finance/financeRoutes.js';
import logisticsRoutes from './modules/logistics/logisticsRoutes.js';
import posRoutes from './modules/pos/posRoutes.js';
import wholesaleRoutes from './modules/wholesale/wholesaleRoutes.js';
import appsRoutes from './modules/apps/appsRoutes.js';
import subscriptionsRoutes from './modules/subscriptions/subscriptionsRoutes.js';
import platformAdminRoutes from './modules/platformAdmin/platformAdminRoutes.js';

export const createApp = () => {
  const app = express();

  // 1. Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // 2. Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.allowedOrigins.includes(origin) || config.env === 'test') {
          return callback(null, true);
        }
        try {
          const { hostname } = new URL(origin);
          if (
            hostname.endsWith(`.${config.platformDomain}`) ||
            hostname === 'localhost' ||
            hostname === '127.0.0.1'
          ) {
            return callback(null, true);
          }
        } catch {}
        return callback(null, true); // Allow during dev/staging
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'X-Requested-With'],
    })
  );

  // 3. Body & Cookie Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(config.cookieSecret));

  // 4. Health Check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      app: config.appName,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // 5. Mount API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/tenants', tenantRoutes);
  app.use('/api/v1/products', productRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/orders', orderRoutes);
  app.use('/api/v1/storefront', storefrontRoutes);
  app.use('/api/v1/purchases', purchaseRoutes);
  app.use('/api/v1/finance', financeRoutes);
  app.use('/api/v1/logistics', logisticsRoutes);
  app.use('/api/v1/pos', posRoutes);
  app.use('/api/v1/wholesale', wholesaleRoutes);
  app.use('/api/v1/apps', appsRoutes);
  app.use('/api/v1/subscriptions', subscriptionsRoutes);
  app.use('/api/v1/platform-admin', platformAdminRoutes);

  // 6. 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found.`,
      },
    });
  });

  // 7. Global Error Handler
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    const isProduction = config.env === 'production';

    if (!isProduction && status === 500) {
      console.error('Unhandled Application Error:', err);
    }

    res.status(status).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: isProduction && status === 500 ? 'An unexpected error occurred.' : err.message,
        ...(isProduction ? {} : { stack: err.stack }),
      },
    });
  });

  return app;
};

export default createApp;

