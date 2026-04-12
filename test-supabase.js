require('dotenv').config({ path: './nexcard-mvp/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Fetching profiles...');
  const { data, error } = await supabase.from('profiles').select('slug, full_name, status');
  console.log('Profiles:', data);
  console.log('Error:', error);
}
test();
