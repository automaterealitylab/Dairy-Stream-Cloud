import '../config/loadEnv.js';
import { supabase } from '../config/supabase.js';
import { decryptDeterministic } from '../utils/crypto.js';

async function run() {
  const { data, error } = await supabase
    .from('admins')
    .select('id, dairy_id, name, email, phone, phone_number')
    .order('id', { ascending: true })
    .limit(20);

  if (error) {
    console.error('Error fetching admins:', error);
    process.exit(1);
  }

  data.forEach((a) => {
    console.log('Admin ID:', a.id);
    console.log('  dairy_id:', a.dairy_id);
    console.log('  name:', a.name);
    console.log('  email raw:', a.email);
    console.log('  email decrypted:', decryptDeterministic(a.email));
    console.log('  phone raw:', a.phone);
    console.log('  phone decrypted:', decryptDeterministic(a.phone));
    console.log('  phone_number raw:', a.phone_number);
    console.log('  phone_number decrypted:', decryptDeterministic(a.phone_number));
    console.log('---');
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
