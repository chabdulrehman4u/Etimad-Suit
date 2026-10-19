import express from 'express';
import { registerTenant, login, logout, getMe } from './authController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext } from '../../middleware/tenant.js';

const router = express.Router();

router.post('/register-tenant', registerTenant);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticate, resolveTenantContext, getMe);

export default router;

