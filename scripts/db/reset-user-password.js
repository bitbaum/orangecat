const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function resetUserPassword() {
  const email = 'test@orangecat.ch';
  const newPassword = 'TestPassword123!';

  try {
    console.log('🔧 Resetting user password...');

    // Method 1: Update user password using admin API
    const { data: user, error: updateError } = await supabase.auth.admin.updateUserById(
      'e954df8f-6a9b-4cb1-8c3f-8518dc78f846',
      { password: newPassword }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError.message);

      // Method 2: Delete and recreate user
      console.log('🔄 Trying to delete and recreate user...');

      // Delete user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        'e954df8f-6a9b-4cb1-8c3f-8518dc78f846'
      );

      if (deleteError && !deleteError.message.includes('User not found')) {
        console.error('❌ Error deleting user:', deleteError.message);
      }

      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: newPassword,
        email_confirm: true,
      });

      if (createError) {
        console.error('❌ Error creating user:', createError.message);
        return;
      }

      console.log('✅ User recreated successfully');
      console.log('User ID:', newUser.user.id);

      // Create/update profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: newUser.user.id,
        // Never the raw email — a public, crawlable handle republishing
        // someone's address is the exact leak fixed in
        // supabase/migrations/20260826130000_stop_deriving_usernames_from_email.sql.
        // Mirrors src/lib/profile/neutral-username.ts (plain JS script, can't import it).
        username: 'user_' + newUser.user.id.replace(/-/g, '').slice(0, 12),
        full_name: 'Test User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        console.error('❌ Error creating profile:', profileError.message);
      } else {
        console.log('✅ Profile created successfully');
      }
    } else {
      console.log('✅ Password updated successfully');
      console.log('User ID:', user.user.id);
    }

    // Test authentication
    console.log('🧪 Testing authentication...');

    // Create a new client instance for testing
    const testClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: signInData, error: signInError } = await testClient.auth.signInWithPassword({
      email: email,
      password: newPassword,
    });

    if (signInError) {
      console.error('❌ Authentication test failed:', signInError.message);
    } else {
      console.log('✅ Authentication test successful!');
      console.log('Authenticated user:', signInData.user.email);

      // Sign out to clean up
      await testClient.auth.signOut();
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

resetUserPassword();
