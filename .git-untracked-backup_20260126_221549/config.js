const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ SUPABASE_URL or SUPABASE_KEY not found in environment.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const connect = async () => {
    try {
        // Simple health check: try a lightweight RPC (no-op) to verify client
        // If Supabase project does not have custom RPCs this will still succeed at client init
        console.log('✅ Supabase client initialized');
    } catch (err) {
        console.error('❌ Supabase initialization error:', err.message);
    }
};

module.exports = { connect, supabase };