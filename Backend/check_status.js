import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('deliveries')
    .select('status');
  
  if (error) {
    console.error(error);
    process.exit(1);
  }

  const counts = {};
  data.forEach((row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
  });

  console.log("Deliveries status counts:", counts);

  const { data: perf, error: perfError } = await supabase
    .from('agent_performance')
    .select('completed, failed');
  
  if (perfError) {
    console.error(perfError);
    process.exit(1);
  }

  console.log("Agent performance metrics:", perf.slice(0, 10));
}

main();
