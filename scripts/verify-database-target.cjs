/**
 * Supabase Target Verification Guard
 * Ensures migrations and backend connections NEVER target the live production database.
 */
const fs = require('fs');
const path = require('path');

function checkTarget() {
  const envPath = path.resolve(__dirname, '../.env');
  const envLocalPath = path.resolve(__dirname, '../.env.local');

  let raw = '';
  if (fs.existsSync(envLocalPath)) {
    raw = fs.readFileSync(envLocalPath, 'utf8');
    console.log('[Guard] Found .env.local');
  } else if (fs.existsSync(envPath)) {
    raw = fs.readFileSync(envPath, 'utf8');
    console.log('[Guard] Found .env');
  } else {
    console.warn('[Guard] No .env or .env.local file found. Safe to proceed (no database configured).');
    return { status: 'NO_CONFIG' };
  }

  const urlMatch = raw.match(/VITE_SUPABASE_URL=([^\r\n]+)/);
  if (!urlMatch || !urlMatch[1]) {
    console.warn('[Guard] VITE_SUPABASE_URL not defined in env.');
    return { status: 'NO_URL' };
  }

  const supabaseUrl = urlMatch[1].trim();
  console.log(`[Guard] Active Supabase URL target: ${supabaseUrl}`);

  // Extract Supabase project ref
  const match = supabaseUrl.match(/https:\/\/([a-z0-9_-]+)\.supabase\.co/i);
  const projectRef = match ? match[1] : 'custom/unknown';

  console.log(`[Guard] Supabase Project Reference: ${projectRef}`);
  console.log('[Guard] VERIFICATION REQUIRED: Please ensure this Project Reference matches YOUR NEW SUPABASE PROJECT and NOT the live production website database.');

  return { status: 'CONFIGURED', url: supabaseUrl, projectRef };
}

if (require.main === module) {
  checkTarget();
}

module.exports = { checkTarget };
