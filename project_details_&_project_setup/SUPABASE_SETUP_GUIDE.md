# Supabase Setup Guide for Dairy Automation System

## Overview
This guide will help you migrate from MongoDB to Supabase PostgreSQL database for the Dairy Automation System.

---

## Step 1: Create Supabase Account and Project

1. **Go to Supabase**: Visit [https://supabase.com](https://supabase.com)
2. **Sign Up/Login**: Create or sign in to your account
3. **Create a New Project**:
   - Click "New Project"
   - Enter project name: `dairy-automation-system`
   - Set a strong database password (save it securely)
   - Select your region (closest to your location for best performance)
   - Click "Create new project" and wait for setup to complete (2-3 minutes)

---

## Step 2: Get Your Credentials

Once your project is created:

1. **Go to Settings** (bottom left corner)
2. **Click "API"**
3. **Copy these credentials** and save them:
   - `Project URL` → Use as `SUPABASE_URL`
   - `anon public` key → Use as `SUPABASE_ANON_KEY`
   - `service_role` key → Use as `SUPABASE_SERVICE_KEY`

4. **Update Backend .env file**:
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 3: Create Database Tables

Go to **Supabase Dashboard** → **SQL Editor** and run these SQL scripts:

### 3.1 Create Customers Table
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  building_name VARCHAR(255) NOT NULL,
  wing VARCHAR(100),
  room_no VARCHAR(50) NOT NULL,
  default_milk_quantity_liters DECIMAL(5, 2) DEFAULT 1.0,
  default_extra_product VARCHAR(50) DEFAULT 'None',
  default_extra_product_quantity DECIMAL(5, 2) DEFAULT 0,
  billing_cycle VARCHAR(50) DEFAULT 'Monthly',
  date_joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster email lookups
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone_number);
```

### 3.2 Create Agents Table
```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  region VARCHAR(255),
  assigned_customers INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  date_joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agents_email ON agents(email);
CREATE INDEX idx_agents_status ON agents(status);
```

### 3.3 Create Milk Deliveries Table
```sql
CREATE TABLE milk_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL,
  quantity_liters DECIMAL(5, 2) NOT NULL,
  quality_rating VARCHAR(50),
  extra_products VARCHAR(255),
  extra_quantity DECIMAL(5, 2),
  amount_collected DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deliveries_customer ON milk_deliveries(customer_id);
CREATE INDEX idx_deliveries_agent ON milk_deliveries(agent_id);
CREATE INDEX idx_deliveries_date ON milk_deliveries(delivery_date);
```

### 3.4 Create Products Table
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  stock_quantity INT DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_category ON products(category);
```

### 3.5 Create Billing Records Table
```sql
CREATE TABLE billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  total_liters DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  payment_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_billing_customer ON billing_records(customer_id);
CREATE INDEX idx_billing_status ON billing_records(status);
```

---

## Step 4: Update Backend Dependencies

Add Supabase client library to your backend:

```bash
cd Backend
npm install @supabase/supabase-js
npm install bcryptjs jsonwebtoken cors dotenv express
```

---

## Step 5: Update Backend Code

### 5.1 Update `config.js`
Already updated! It now connects to Supabase PostgreSQL instead of MongoDB.

### 5.2 Update Controllers
You'll need to refactor controllers from Mongoose to Supabase queries.

**Example: CustomerController.js refactor**
```javascript
const { supabase } = require('../config');
const bcrypt = require('bcryptjs');

exports.addCustomer = async (req, res) => {
  try {
    const data = req.body;
    const { email, password } = data;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert into Supabase
    const { data: result, error } = await supabase
      .from('customers')
      .insert([{
        ...data,
        password: hashedPassword
      }])
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: "✅ Customer added successfully",
      data: result[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
```

---

## Step 6: Frontend Environment Configuration

Create a `.env` file in your Frontend folder:

```
VITE_API_URL=http://localhost:4000
```

Update your API calls in `api/mockData.js` or create an `api/client.js`:

```javascript
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## Step 7: Test Connection

1. **Start the backend**:
```bash
cd Backend
npm start
```

2. **Check console** for message:
```
✅ Connected to Supabase PostgreSQL
```

3. **Test with a registration request**:
```bash
curl -X POST http://localhost:4000/api/customer/addCustomer \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "customerName": "John Doe",
    "phoneNumber": "9876543210",
    "buildingName": "Test Building",
    "roomNo": "101"
  }'
```

---

## Step 8: Enable Row-Level Security (Optional but Recommended)

1. Go to **Authentication** → **Policies**
2. Enable RLS on all tables
3. Create policies to control data access:

```sql
-- Example: Customers can only see their own data
CREATE POLICY "Customers can view own data" ON customers
  FOR SELECT USING (auth.uid() = id);
```

---

## Step 9: Backup and Data Migration

### Backup your data:
1. Go to **Database** → **Backups**
2. Click "Create backup"
3. Store backups securely

### If migrating from MongoDB:
```bash
# Export MongoDB data
mongoexport --db dairy_db --collection customers --out customers.json

# You'll need to transform and import into Supabase
# A script can be created to do this automatically
```

---

## Useful Supabase Resources

- **Official Docs**: https://supabase.com/docs
- **JavaScript Client**: https://supabase.com/docs/reference/javascript
- **SQL Reference**: https://supabase.com/docs/guides/database
- **Authentication**: https://supabase.com/docs/guides/auth

---

## Common Issues & Solutions

### Issue: "Unable to connect to Supabase"
- **Solution**: Check if `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Verify project is active in Supabase dashboard

### Issue: "Relation does not exist" error
- **Solution**: Make sure all tables are created via SQL editor
- Refresh your page and retry

### Issue: "Invalid JWT"
- **Solution**: Use `SUPABASE_ANON_KEY` (not service key) for client connection
- Service key is for backend only

### Issue: Slow queries
- **Solution**: Check if indexes are created
- Monitor query performance in **Database** → **Monitoring**

---

## Next Steps

1. ✅ Create Supabase project
2. ✅ Get credentials
3. ✅ Create database tables
4. ✅ Update backend code
5. ✅ Test connection
6. ✅ Enable security features
7. Continue with refactoring remaining controllers
8. Update all models to use Supabase queries
9. Test all routes thoroughly
10. Deploy to production

---

**Team Lead**: Assign tasks to each developer based on module responsibility.

**For Questions**: Refer to Supabase documentation or contact your database admin.
