# Implementation Guide - Delivery Proof, Performance Tracking & Earnings

This guide outlines the new features implemented for the Dairy-Stream-Cloud application.

## Features Implemented

### 1. Delivery Proof (Photo OR OTP Confirmation)
**Location**: Frontend - `DeliveryDetailsModal.jsx`

**Features**:
- Agents can submit delivery proof using either:
  - Photo upload (from camera or file)
  - OTP confirmation with customer
- Proof is required to mark delivery as COMPLETED
- Both types are stored in the database

**Database Tables**:
- `deliveries` - stores `proof_type`, `proof_photo_url`, `proof_otp`, `otp_verified_at`
- `delivery_proofs` - optional table for tracking proof submission history

**Usage**:
```javascript
// In DeliveryDetailsModal.jsx
const handleProofSubmit = async (proofData) => {
  // proofData.proofType: 'PHOTO' or 'OTP'
  // proofData.photo: File object
  // proofData.otp: OTP string
  await onProofSubmit(proofData);
};
```

---

### 2. Failed Delivery Logging
**Location**: Frontend - `FailedReasonModal.jsx`

**Failure Reasons** (Predefined):
- `CUSTOMER_UNAVAILABLE` - Customer not available for delivery
- `PAYMENT_ISSUE` - Customer payment pending/issue
- `WRONG_ADDRESS` - Incorrect delivery address
- `OTHER` - Other reasons (requires additional details)

**Features**:
- Mandatory reason selection from predefined list
- Optional detailed reason for "OTHER" category
- Optional photo proof upload
- Database stores both reason and details

**Database Fields**:
```sql
failed_reason VARCHAR(50) -- CUSTOMER_UNAVAILABLE, PAYMENT_ISSUE, WRONG_ADDRESS, OTHER
failed_reason_details TEXT -- Additional details for OTHER reason
proof_photo_url TEXT -- Photo evidence of failed delivery
```

**Usage**:
```javascript
// Selected reason is stored as:
{
  reason: 'CUSTOMER_UNAVAILABLE',
  reasonDetails: '', // only if OTHER
  image: File,
  imagePreview: DataURL
}
```

---

### 3. Agent Performance Tracking
**Location**: 
- Backend: `controllers/admin/agentPerformance.controller.js`
- Backend: `services/admin/agentPerformance.service.js`
- Frontend: `pages/admin/AdminPerformanceDashboard.jsx`

**Admin Dashboard Shows**:
- **Total Agents**: Number of active agents
- **Total Deliveries**: Overall delivery count
- **Completed Deliveries**: Number of successful deliveries
- **Missed Deliveries**: Failed deliveries count
- **Overall Efficiency**: Completion percentage

**Performance Metrics**:
- Deliveries completed per agent
- Missed/failed deliveries
- Efficiency percentage (completed/total)
- Completion rate
- Daily performance breakdown

**Database Table** - `agent_performance`:
```sql
CREATE TABLE agent_performance (
  agent_id BIGINT,
  performance_date DATE,
  total_assigned BIGINT,
  completed BIGINT,
  failed BIGINT,
  pending BIGINT,
  completion_rate NUMERIC(5, 2),  -- %
  efficiency_percentage NUMERIC(5, 2) -- %
)
```

**API Endpoints**:
```
GET  /api/admin/performance              -- Get performance metrics
GET  /api/admin/performance/summary      -- Summary for today
GET  /api/admin/performance/top-performers   -- Top agents
GET  /api/admin/performance/missed-deliveries -- Failed deliveries
POST /api/admin/performance/update       -- Update metrics
```

**Dashboard Features**:
- Performance by agent (bar chart)
- Efficiency distribution (pie chart)
- Top performers ranking
- Failure reasons breakdown
- Recent missed deliveries table
- Date range filtering (7 days, 30 days, this month)

---

### 4. Earnings & Work Summary
**Location**:
- Backend: `controllers/admin/agentEarnings.controller.js`
- Backend: `services/admin/agentEarnings.service.js`
- Frontend: `pages/agent/AgentEarnings.jsx`

**Agent Sees**:
- **Daily Deliveries**: Total assigned vs completed
- **Completed Count**: Number of successful deliveries
- **Daily Earnings**: Based on completed deliveries
- **Bonus Amount**: Performance-based bonus
- **Net Earnings**: Total minus any deductions

**Database Table** - `agent_earnings`:
```sql
CREATE TABLE agent_earnings (
  agent_id BIGINT,
  earning_date DATE,
  deliveries_completed BIGINT,
  earning_per_delivery NUMERIC(10, 2),  -- Default: ₹50
  total_earnings NUMERIC(10, 2),
  bonus_amount NUMERIC(10, 2),
  deductions NUMERIC(10, 2),
  net_earnings NUMERIC(10, 2)
)
```

**API Endpoints**:
```
GET  /api/admin/earnings                -- Get earnings for date range
GET  /api/admin/earnings/today-summary  -- Today's work summary
GET  /api/admin/earnings/summary        -- Earnings summary for period
POST /api/admin/earnings/calculate      -- Calculate/update earnings
```

**Earnings Page Shows**:
- Today's summary cards:
  - Total Deliveries
  - Completed (with progress %)
  - Pending/Failed
  - Today's Earnings
- Progress bar for daily completions
- Earnings summary (Total, Per Day, Average)
- Daily breakdown table
- Date range filtering

---

### 5. Connectivity Indicator
**Location**: 
- Component: `components/common/ConnectivityIndicator.jsx`
- Utilities: `utils/offlineSyncManager.js`

**Features**:
- Real-time online/offline status display
- Sync status indicator (synced, syncing, pending)
- Pending item count badge
- Manual sync trigger
- Hover tooltips with detailed status
- Banner version for page-level display

**Connectivity States**:
1. **Online** - Green indicator, "Online"
2. **Offline** - Red indicator, "Offline"
3. **Syncing** - Yellow indicator, "Syncing..." with spinner
4. **Pending** - Orange indicator, shows count of pending items

**Offline Support**:
- Deliveries posted offline are queued in localStorage
- Proofs submitted offline are queued in localStorage
- Automatic sync when coming back online
- Manual sync trigger if needed

**Usage in Components**:
```javascript
import ConnectivityIndicator, { ConnectivityBanner } from '../../components/common/ConnectivityIndicator';

// In header/navigation
<ConnectivityIndicator />

// Page-level banner
<ConnectivityBanner />
```

**Offline Sync Manager**:
```javascript
import { offlineSyncManager, DeliveryManager } from '../../utils/offlineSyncManager';

// Sync pending items
const result = await offlineSyncManager.syncPendingItems(api);

// Update delivery with offline support
await DeliveryManager.updateDeliveryStatus(deliveryId, status, api);

// Submit proof with offline support
await DeliveryManager.submitDeliveryProof(deliveryId, proofType, file, otp, api);

// Mark as failed with offline support
await DeliveryManager.markDeliveryFailed(deliveryId, reason, details, file, api);
```

---

## Database Setup

Run these SQL migrations in Supabase:

```sql
-- Already included in SUPABASE_MIGRATIONS.sql
-- New tables:
-- - deliveries
-- - delivery_proofs
-- - agent_performance
-- - agent_earnings
```

---

## API Integration

### Frontend API Module
**File**: `src/api/performance.api.js`

**Modules**:
```javascript
import {
  agentPerformanceAPI,
  agentEarningsAPI,
  deliveryAPI
} from './performance.api.js';

// Performance
agentPerformanceAPI.getPerformance(agentId, startDate, endDate)
agentPerformanceAPI.getPerformanceSummary()
agentPerformanceAPI.getTopPerformers(limit)
agentPerformanceAPI.getMissedDeliveries(startDate, endDate)
agentPerformanceAPI.updatePerformanceMetrics(agentId, date)

// Earnings
agentEarningsAPI.getEarnings(agentId, startDate, endDate)
agentEarningsAPI.getTodayWorkSummary(agentId)
agentEarningsAPI.getSummary(agentId, startDate, endDate)
agentEarningsAPI.calculateEarnings(agentId, date, earningPerDelivery)

// Deliveries
deliveryAPI.getDeliveries(agentId, date)
deliveryAPI.updateDeliveryStatus(deliveryId, status)
deliveryAPI.submitDeliveryProof(deliveryId, proofType, file, otp)
deliveryAPI.markDeliveryFailed(deliveryId, reason, details, file)
```

---

## Integration Steps

### 1. Update Routes (Backend)
Add these new routes to `Backend/routes/`:

```javascript
// Example: agentDeliveries.routes.js
router.get('/deliveries', getDeliveries);
router.patch('/deliveries/:deliveryId/status', updateStatus);
router.post('/deliveries/:deliveryId/proof', submitProof);
router.post('/deliveries/:deliveryId/failed', markFailed);
router.get('/deliveries/:deliveryId', getDeliveryDetails);
router.post('/deliveries/bulk-update', bulkUpdateStatus);
```

### 2. Add to Admin Dashboard
Integrate `AdminPerformanceDashboard.jsx` in admin navigation

### 3. Add to Agent Pages
Integrate `AgentEarnings.jsx` in agent navigation

### 4. Add Connectivity Indicator
Add to main layout/header component:
```javascript
<ConnectivityIndicator />
```

### 5. Update DeliveryDetailsModal Usage
Pass `onProofSubmit` callback:
```javascript
<DeliveryDetailsModal
  delivery={selectedDelivery}
  onClose={() => setSelectedDelivery(null)}
  onProofSubmit={handleProofSubmit}
/>
```

---

## Configuration

### Environment Variables
```
REACT_APP_API_URL=http://localhost:5000/api
```

### Earnings Configuration
Default earning per delivery: ₹50 (configurable via API)

---

## Testing Checklist

- [ ] Delivery proof submission (photo)
- [ ] Delivery proof submission (OTP)
- [ ] Failed delivery logging with predefined reasons
- [ ] Failed delivery logging with custom reason
- [ ] Admin dashboard loads performance data
- [ ] Admin dashboard shows top performers
- [ ] Admin dashboard shows failure reasons
- [ ] Agent earnings page loads correctly
- [ ] Agent earnings calculations are correct
- [ ] Connectivity indicator shows online/offline status
- [ ] Offline deliveries sync when coming back online
- [ ] All API endpoints respond correctly

---

## Future Enhancements

1. **Advanced Performance Analytics**
   - Weekly/monthly trends
   - Performance comparison charts
   - Agent ranking system

2. **Earnings Enhancements**
   - Dynamic earning rates based on efficiency
   - Bonus/penalty system
   - Payment history and invoices

3. **Geolocation Features**
   - Real-time location tracking
   - Route optimization with proof
   - Delivery map view

4. **Advanced Offline Support**
   - Local database (IndexedDB)
   - Background sync with Service Workers
   - Conflict resolution for offline updates

5. **Notifications**
   - Delivery proof reminders
   - Earnings alerts
   - Performance notifications

---

## Support & Documentation

For detailed implementation of individual features, refer to:
- Database schema: `SUPABASE_MIGRATIONS.sql`
- Frontend components: `Frontend/src/components/agent/`
- Backend services: `Backend/services/`
- API utilities: `Frontend/src/api/performance.api.js`

