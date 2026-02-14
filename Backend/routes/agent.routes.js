import express from 'express';
// We import from 'shared' because both Admins and Agents need this list
import { getUniqueBuildings } from '../controllers/shared/building.controller.js';

const router = express.Router();

// ==========================================
// 🏢 BUILDING ROUTES
// ==========================================

// Endpoint: GET http://localhost:4000/api/agent/buildings
router.get('/buildings', getUniqueBuildings);


// ==========================================
// ❌ REMOVED ROUTES
// ==========================================
// The '/addAgent' route has been removed from here.
// It is correctly located in 'admin.routes.js' now.


export default router;