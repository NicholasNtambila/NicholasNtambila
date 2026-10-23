/**
 * Confirm a Supabase account with the OTP from the confirmation email.
 * Usage:  node scripts/confirm-user.mjs <otp-code>
 * Example: node scripts/confirm-user.mjs 123456
 */

const OTP = process.argv[2];
const EMAIL = process.argv[3] || process.env.EXPO_PUBLIC_USER_EMAIL || 'admin@sanitech.zm';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wqjwrunnywmpoumckrir.supabase.co';
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_v-UPAEg9moJq-SK_qWXNoQ_Itor0MaQ';

if (!OTP || !/^\d{6}$/.test(OTP)) {
  console.error('Usage: node scripts/confirm-user.mjs <6-digit-otp> [email]');
  console.error('Example: node scripts/confirm-user.mjs 123456 user@example.com');
  process.exit(1);
}

console.log(`Confirming ${EMAIL} with OTP: ${OTP}...`);

const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: PUBLISHABLE_KEY,
    Authorization: `Bearer ${PUBLISHABLE_KEY}`,
  },
  body: JSON.stringify({
    type: 'signup',
    email: EMAIL,
    token: OTP,
  }),
});

const data = await res.json();

if (res.ok && data.access_token) {
  console.log('✅ Account confirmed and logged in!');
  console.log('Email:', data.user?.email);
  console.log('User ID:', data.user?.id);
  console.log('Role:', data.user?.role);
  console.log('\nCredentials are now active. You can log in to the app.');
} else {
  console.error('❌ Failed to confirm:');
  console.error(JSON.stringify(data, null, 2));
  console.error('\nMake sure you used the latest OTP code from your email.');
}
