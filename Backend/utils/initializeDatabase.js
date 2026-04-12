const { Client } = require('pg');

/**
 * Initialize database tables if they don't exist
 * Uses direct PostgreSQL connection via Supabase
 * This is non-blocking - server will continue even if this fails
 */
const initializeDatabase = async () => {
  let client;
  
  // Run initialization in background without blocking server startup
  setImmediate(async () => {
    try {
      console.log('🔄 Attempting to initialize database tables...');
      
      // Create connection string
      const connectionString = getConnectionString();
      
      client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false },
        connect_timeout: 5000
      });
      
      // Connect to database
      await client.connect();
      console.log('✅ Connected to Supabase PostgreSQL');

      // SQL statements to create tables
      const customersTableSQL = `
        CREATE TABLE IF NOT EXISTS public.customers (
          id BIGSERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          customer_name VARCHAR(255),
          phone_number VARCHAR(20),
          address_line_1 VARCHAR(255),
          address_line_2 VARCHAR(255),
          building_name VARCHAR(255),
          wing VARCHAR(50),
          room_no VARCHAR(50),
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          default_milk_quantity_liters NUMERIC(10, 2) DEFAULT 1.0,
          default_extra_product VARCHAR(255) DEFAULT 'None',
          default_extra_product_quantity NUMERIC(10, 2) DEFAULT 0,
          billing_cycle VARCHAR(50) DEFAULT 'Monthly',
          date_joined TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      const agentsTableSQL = `
        CREATE TABLE IF NOT EXISTS public.agents (
          id BIGSERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          agent_name VARCHAR(255),
          phone_number VARCHAR(20),
          building VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      const indexesSQL = `
        CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
        CREATE INDEX IF NOT EXISTS idx_customers_building ON public.customers(building_name);
        CREATE INDEX IF NOT EXISTS idx_agents_email ON public.agents(email);
        CREATE INDEX IF NOT EXISTS idx_agents_building ON public.agents(building);
      `;

      // Execute all SQL statements
      await client.query(customersTableSQL);
      console.log('✅ Customers table created/verified');

      await client.query(agentsTableSQL);
      console.log('✅ Agents table created/verified');

      await client.query(indexesSQL);
      console.log('✅ Indexes created/verified');

      console.log('✅ Database initialization complete');
    } catch (error) {
      console.error('\n❌ AUTOMATIC TABLE CREATION FAILED');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('\n📝 MANUAL SETUP REQUIRED:');
      console.error('\n1. Go to: https://app.supabase.com');
      console.error('2. Select your "Dairy Automation" project');
      console.error('3. Click "SQL Editor" → "New Query"');
      console.error('4. Copy and paste the SQL from SUPABASE_MIGRATIONS.sql');
      console.error('5. Click "RUN" button');
      console.error('\nError details:', error.message);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } finally {
      // Always close the connection
      if (client) {
        try {
          await client.end();
        } catch (err) {
          // Ignore close errors
        }
      }
    }
  });
};

/**
 * Get PostgreSQL connection string
 */
function getConnectionString() {
  // Use explicit connection string if provided
  if (process.env.SUPABASE_DB_URL) {
    return process.env.SUPABASE_DB_URL;
  }

  // Otherwise, try to build from Supabase credentials
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const projectRef = process.env.SUPABASE_PROJECT_REF;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required in .env');
  }

  // Extract project reference from URL
  // URL format: https://projectname.supabase.co
  let projectName = projectRef;
  if (!projectName) {
    const urlParts = supabaseUrl.replace('https://', '').replace('http://', '').split('.');
    projectName = urlParts[0];
  }

  // Build connection string using standard Supabase pooling connection
  // Format: postgresql://postgres.projectname:service_key@aws-0-region.pooling.supabase.com:6543/postgres
  const connectionString = `postgresql://postgres.${projectName}:${supabaseKey}@aws-0-us-east-1.pooling.supabase.com:6543/postgres`;
  
  return connectionString;
}

module.exports = initializeDatabase;
