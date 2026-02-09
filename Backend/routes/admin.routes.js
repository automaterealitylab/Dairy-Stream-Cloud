import express from 'express';
import { adminLogin } from '../controllers/authentication/admin/auth.controller.js';

const router = express.Router();

// --- Auth ---
router.post('/login', adminLogin); // URL: /api/admin/login

// --- Protected Routes (Future) ---
// router.get('/dashboard', adminMiddleware, getDashboardStats);
// router.post('/staff/add', adminMiddleware, addStaff);

export default router;