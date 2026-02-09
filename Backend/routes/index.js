import express from 'express';
import publicRoutes from './public.routes.js';
import customerRoutes from './customer.routes.js';
import adminRoutes from './admin.routes.js';

const router = express.Router();

// 1. Public Routes (Base: /api)
router.use('/', publicRoutes);

// 2. Customer Routes (Base: /api/customer)
// Any route inside customer.routes.js automatically gets "/customer" prefix
router.use('/customer', customerRoutes);

// 3. Admin Routes (Base: /api/admin)
router.use('/admin', adminRoutes);

export default router;