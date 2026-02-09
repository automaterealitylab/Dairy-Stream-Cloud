import express from 'express';
import { checkUserStatus } from '../controllers/authentication/check.auth.js';

const router = express.Router();

// The Gatekeeper (Smart Detect)
router.post('/detect', checkUserStatus);

// Future: router.get('/explore', exploreController.getDairies);

export default router;