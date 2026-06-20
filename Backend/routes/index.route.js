import express from 'express';
import publicRoutes from './public.routes.js';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import customerRoutes from './customer.routes.js';
import agentRoutes from './agent.routes.js';
import locationRoutes from './location.js';
import { authRateLimit } from '../middleware/security.middleware.js';

const router = express.Router();

// 1. Public Routes (Base: /api/public)
router.use('/public', publicRoutes);

// 2. Customer Routes (Base: /api/customer)
router.use('/customer', customerRoutes);
 
// 3. Admin Routes (Base: /api/admin)
router.use('/admin', adminRoutes);  // add addagent route in admin routes cause admin create the agent
//agent routes (/api/agent)
router.use('/agent', agentRoutes);
router.use('/location', locationRoutes);

// 4. Auth Routes (Base: /api/auth)
router.use('/auth', authRateLimit, authRoutes);



export default router;
