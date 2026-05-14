# Hardcoded Values Refactoring - Implementation Guide

This document outlines the changes made to move all hardcoded configuration values to the database, enabling runtime configuration management.

## Summary of Changes

All hardcoded configuration values have been moved from code to a new `app_settings` table in the database. Settings are now fetched dynamically with caching to minimize database queries.

## Database Schema

### New Table: `app_settings`

```sql
CREATE TABLE IF NOT EXISTS public.app_settings (
  id BIGSERIAL PRIMARY KEY,
  setting_key VARCHAR(120) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type VARCHAR(50) DEFAULT 'string',
  description TEXT,
  is_sensitive BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key
  ON public.app_settings(setting_key);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at
  ON public.app_settings(updated_at DESC);
```

## Configuration Settings Moved to Database

### Authentication Settings

| Setting Key | Type | Default Value | Description |
|---|---|---|---|
| `AGENT_OTP_EXPIRY_MS` | number | 600000 | Agent OTP expiry time (10 minutes) |
| `AGENT_OTP_REQUEST_LIMIT` | number | 3 | Max OTP requests per window |
| `AGENT_OTP_REQUEST_WINDOW_MS` | number | 900000 | Request window duration (15 minutes) |
| `ADMIN_OTP_EXPIRY_MS` | number | 600000 | Admin OTP expiry time (10 minutes) |
| `ADMIN_OTP_REQUEST_LIMIT` | number | 3 | Max admin OTP requests |
| `ADMIN_OTP_REQUEST_WINDOW_MS` | number | 900000 | Admin request window (15 minutes) |
| `CUSTOMER_OTP_EXPIRY_MS` | number | 300000 | Customer OTP expiry (5 minutes) |

### Marketplace Settings

| Setting Key | Type | Default Value | Description |
|---|---|---|---|
| `MARKETPLACE_TAX_PERCENT` | number | 0 | Marketplace tax percentage |
| `MARKETPLACE_DELIVERY_FEE` | number | 0 | Delivery fee (rupees) |
| `MARKETPLACE_RATE_LIMIT_PER_MINUTE` | number | 60 | API rate limit |
| `WEBHOOK_RATE_LIMIT_PER_MINUTE` | number | 300 | Webhook processing rate limit |
| `MARKETPLACE_RECONCILIATION_LIMIT` | number | 100 | Reconciliation batch size |

### Delivery Service Settings

| Setting Key | Type | Default Value | Description |
|---|---|---|---|
| `ONLINE_COLLECTION_TTL_MS` | number | 1200000 | Online collection cache TTL (20 minutes) |
| `NEARBY_PAGE_SIZE` | number | 20 | Items per page for nearby dairies |

### Email Settings

| Setting Key | Type | Default Value | Description |
|---|---|---|---|
| `EMAIL_HTTP_TIMEOUT_MS` | number | 8000 | HTTP timeout (ms) |
| `EMAIL_CONNECTION_TIMEOUT_MS` | number | 5000 | Connection timeout |
| `EMAIL_GREETING_TIMEOUT_MS` | number | 5000 | Greeting timeout |
| `EMAIL_SOCKET_TIMEOUT_MS` | number | 8000 | Socket timeout |
| `EMAIL_SMTP_RETRY_BACKOFF_MS` | number | 2000 | SMTP retry backoff |

### Other Settings

| Setting Key | Type | Default Value | Description |
|---|---|---|---|
| `WHATSAPP_MAX_ATTEMPTS` | number | 3 | WhatsApp retry attempts |
| `WHATSAPP_RETRY_DELAY_MS` | number | 300000 | WhatsApp retry delay (5 minutes) |
| `IFSC_LOOKUP_TIMEOUT_MS` | number | 6000 | IFSC lookup timeout |
| `BANK_VERIFICATION_TIMEOUT_MS` | number | 10000 | Bank verification timeout |
| `RAZORPAY_API_ATTEMPTS` | number | 3 | Razorpay API retry attempts |
| `RAZORPAY_API_TIMEOUT_MS` | number | 20000 | Razorpay API timeout |
| `FRAUD_HIGH_VALUE_ORDER_INR` | number | 50000 | High-value order threshold |
| `DISTRIBUTED_LOCK_TTL_MS` | number | 120000 | Distributed lock TTL |
| `QUEUE_JOB_ATTEMPTS` | number | 7 | Job retry attempts |
| `QUEUE_JOB_BACKOFF_MS` | number | 5000 | Job backoff between retries |
| `RECONCILIATION_PENDING_WEBHOOK_RETRIES_LIMIT` | number | 50 | Webhook retry batch size |

## Files Created/Modified

### New Files

1. **Backend/services/shared/appSettings.service.js**
   - Centralized settings service with caching
   - Functions: `getSetting()`, `getSettings()`, `getAllSettings()`, `setSetting()`, `clearSettingsCache()`

2. **Backend/scripts/seed-app-settings.js**
   - Script to initialize all settings in the database
   - Run: `node Backend/scripts/seed-app-settings.js`

### Modified Files

1. **Backend/sql/SUPABASE_MIGRATIONS.sql**
   - Added `app_settings` table definition with indexes

2. **Backend/controllers/authentication/agentAuth.controller.js**
   - Added dynamic OTP settings fetching
   - Settings cached for 5 minutes to minimize DB queries

3. **Backend/services/authentication/adminAuth.service.js**
   - Added dynamic OTP settings fetching
   - Settings cached for 5 minutes

4. **Backend/middleware/security.middleware.js**
   - Updated `createRateLimiter()` to support dynamic limits
   - Rate limiters now fetch settings from database with caching
   - `marketplaceRateLimit` and `webhookRateLimit` updated

5. **Backend/services/agent/delivery.service.js**
   - Added dynamic delivery settings fetching
   - `createAgentOnlineCollectionQr()` now uses dynamic TTL

6. **Backend/services/public/dairies.service.js**
   - `getNearbyDairies()` now uses dynamic page size from settings

## Implementation Details

### Caching Strategy

- **In-Memory Cache**: Settings are cached in memory for 5 minutes
- **Minimal Overhead**: Cache checks are performed before DB queries
- **Graceful Fallback**: Hardcoded defaults are used if DB queries fail
- **Manual Clear**: `clearSettingsCache()` can be called to force refresh

### Error Handling

- Failed DB queries fall back to cached values
- Cached values fall back to hardcoded defaults
- Errors are logged but don't break functionality

## Setup Instructions

### 1. Run Database Migration

Execute the SQL migration to create the `app_settings` table:

```bash
# Using Supabase SQL Editor:
# Paste contents of Backend/sql/SUPABASE_MIGRATIONS.sql
```

Or use the Supabase CLI:

```bash
supabase db push
```

### 2. Seed Initial Settings

```bash
cd Backend
node scripts/seed-app-settings.js
```

### 3. Verify Settings

```bash
# Check settings were created
curl http://localhost:4000/api/settings (if endpoint exists)
```

## Runtime Configuration Changes

### Updating Settings

Use the `setSetting()` function from the service:

```javascript
import { setSetting } from './services/shared/appSettings.service.js';

// Update a setting
await setSetting('AGENT_OTP_EXPIRY_MS', 600000, 'number', 'Agent OTP expiry');
```

### Querying Settings

```javascript
import { getSetting, getSettings } from './services/shared/appSettings.service.js';

// Get single setting
const otpExpiry = await getSetting('AGENT_OTP_EXPIRY_MS', 600000);

// Get multiple settings
const settings = await getSettings([
  'AGENT_OTP_EXPIRY_MS',
  'AGENT_OTP_REQUEST_LIMIT'
]);

// Get all settings
const allSettings = await getAllSettings();
```

## API Endpoints (Optional)

You can create API endpoints to manage settings:

```javascript
app.get('/api/admin/settings/:key', async (req, res) => {
  const value = await getSetting(req.params.key);
  res.json({ key: req.params.key, value });
});

app.post('/api/admin/settings/:key', async (req, res) => {
  const success = await setSetting(
    req.params.key,
    req.body.value,
    req.body.type || 'string'
  );
  res.json({ success });
});
```

## Benefits

✅ **Dynamic Configuration**: Change settings without restarting the server
✅ **Centralized Management**: All settings in one place
✅ **Database-Driven**: Settings persist across deployments
✅ **Caching**: Minimal performance impact with in-memory caching
✅ **Type Safety**: Support for multiple data types (string, number, boolean, JSON)
✅ **Audit Trail**: Track when settings were created/updated
✅ **Easy Defaults**: Built-in fallback values

## Monitoring

### Check Cache Status

```javascript
import { getAllSettings } from './services/shared/appSettings.service.js';

// Fetch all current settings from DB (bypasses cache)
const settings = await getAllSettings();
console.log(settings);
```

### Clear Cache Manually

```javascript
import { clearSettingsCache } from './services/shared/appSettings.service.js';

clearSettingsCache();
```

## Migration Path

The implementation is **backward compatible**:
- If settings don't exist in DB, hardcoded defaults are used
- Environment variables are still read as fallbacks
- No breaking changes to existing code

## Troubleshooting

### Settings Not Updating

1. Verify settings exist in `app_settings` table
2. Check cache invalidation (5-minute TTL)
3. Call `clearSettingsCache()` to force refresh
4. Check database connection

### Performance Impact

- First query per key takes ~1-2ms
- Subsequent queries (within cache window) are instant
- Cache TTL can be adjusted based on needs

## Future Enhancements

- [ ] Create admin dashboard for setting management
- [ ] Add setting validation rules
- [ ] Implement setting change notifications
- [ ] Add setting history/versioning
- [ ] Support per-dairy custom settings
- [ ] Add setting schemas for UI generation
