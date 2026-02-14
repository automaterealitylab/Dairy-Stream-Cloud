# Database Setup Guide - Dairy Automation System

## Overview
This guide explains how to set up your Supabase database tables for the Dairy Automation System.

## Automatic Table Creation
The backend server has **automatic table initialization** enabled. When you start the server, it will:
1. Check if the `customers` table exists
2. Check if the `agents` table exists
3. Create these tables automatically if they don't exist
4. Create indexes for better query performance

### Starting the Server with Auto-Initialization
```bash
cd Backend
npm run dev
```

The initialization script will run automatically and log the status:
```
🔄 Checking and initializing database tables...
✅ Customers table created/verified
✅ Agents table created/verified
✅ Database initialization complete
```

## Manual Setup (If Automatic Fails)

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Log in to [https://app.supabase.com](https://app.supabase.com)
   - Select your project

2. **Open SQL Editor**
   - Navigate to **SQL Editor** in the left sidebar
   - Click **"New Query"**

3. **Copy and Paste SQL**
   - Open the file `SUPABASE_MIGRATIONS.sql` in the project root
   - Copy all the SQL code
   - Paste it into the Supabase SQL Editor
   - Click **"Run"** button

4. **Verify Tables**
   - Go to **Table Editor** in the sidebar
   - You should see `customers` and `agents` tables

### Option 2: Using API/CLI

If you prefer using the command line or API:

```bash
# Using Supabase CLI
supabase db push

# Or directly with curl
curl -X POST "https://YOUR_SUPABASE_URL/rest/v1/query" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1"}'
```

## Table Schemas

### Customers Table
```sql
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  phone_number VARCHAR(20),
  building_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id`: Unique customer identifier
- `email`: Customer email (used for login)
- `password`: Bcrypt-hashed password
- `customer_name`: Full name of customer
- `phone_number`: Contact phone number
- `building_name`: Building/location name
- `created_at`: Record creation timestamp
- `updated_at`: Last update timestamp

### Agents Table
```sql
CREATE TABLE agents (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255),
  phone_number VARCHAR(20),
  building VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id`: Unique agent identifier
- `email`: Agent email (used for login)
- `password`: Bcrypt-hashed password
- `agent_name`: Full name of agent
- `phone_number`: Contact phone number
- `building`: Assigned building
- `created_at`: Record creation timestamp
- `updated_at`: Last update timestamp

## Indexes
Created automatically for performance:
- `idx_customers_email` - Fast email lookups
- `idx_customers_building` - Fast building queries
- `idx_agents_email` - Fast email lookups
- `idx_agents_building` - Fast building queries

## Testing the Connection

### Using cURL
```bash
# Register a customer
curl -X POST http://localhost:4000/api/customer/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "customerName": "Test User",
    "phoneNumber": "1234567890",
    "buildingName": "Building A"
  }'

# Login
curl -X POST http://localhost:4000/api/customer/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrPhone": "test@example.com",
    "password": "password123"
  }'
```

### Using Postman
1. Create a new POST request
2. Set URL to `http://localhost:4000/api/customer/register`
3. Set Headers: `Content-Type: application/json`
4. Set Body (raw JSON):
```json
{
  "email": "test@example.com",
  "password": "password123",
  "customerName": "Test User",
  "phoneNumber": "1234567890",
  "buildingName": "Building A"
}
```
5. Click **Send**

## Troubleshooting

### Tables not being created
1. Check that `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set in `.env`
2. Verify Supabase project is active and accessible
3. Check Supabase dashboard for any errors
4. Manually run the SQL from `SUPABASE_MIGRATIONS.sql`

### Connection errors
1. Verify `.env` has correct Supabase credentials
2. Check network connectivity to Supabase
3. Ensure port 4000 is available

### Permission errors
1. Use the **service key** (not the public/anon key) in `SUPABASE_SERVICE_KEY`
2. In Supabase, go to **Settings > API** and copy the Service Key
3. Update `.env` with the correct key

## Environment Variables
Required in `.env`:
```
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

Get these from Supabase Dashboard:
1. Go to **Settings > API**
2. Copy the values for your project
3. Paste into `.env`

## Next Steps
After tables are created:
1. Start the backend server: `npm run dev`
2. Start the frontend server: `cd Frontend && npm run dev`
3. Register new users through the application
4. Test login functionality
5. Verify data is being stored in Supabase

## Support
If you encounter issues:
1. Check the backend console for error messages
2. Check Supabase dashboard for any alerts
3. Verify all credentials are correct in `.env`
4. Try manual setup using Supabase SQL Editor
