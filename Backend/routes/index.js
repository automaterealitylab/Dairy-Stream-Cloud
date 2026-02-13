import express from 'express';
import publicRoutes from './public.routes.js';
import adminRoutes from './admin.routes.js';
import authRoutes from './authroutes.js';
import customerRoutes from './CustomerRoutes.js';

const router = express.Router();

// 1. Public Routes (Base: /api)
router.use('/', publicRoutes);

// 2. Customer Routes (Base: /api/customer)
router.use('/customer', customerRoutes);
 
// 3. Admin Routes (Base: /api/admin)
router.use('/admin', adminRoutes);

// 4. Auth Routes (Base: /api/auth)
router.use('/auth', authRoutes);

export default router;
