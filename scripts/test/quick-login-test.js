// Quick Login Test for the E2E test account
// Run this in browser console at https://www.orangecat.ch/auth?mode=login

(async () => {
  console.log('🧪 Testing the E2E test account login...');

  try {
    // Get the Supabase client from the page
    const supabase = window.supabase;

    if (!supabase) {
      console.log("❌ Supabase client not found. Make sure you're on the login page.");
      return;
    }

    console.log('🔑 Attempting login...');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: window.prompt('Test account email'),
      password: window.prompt('Test account password'),
    });

    if (error) {
      console.error('❌ Login failed:', error.message);
      return;
    }

    if (data.user) {
      console.log('✅ Login successful!');
      console.log('User:', data.user.email);
      console.log('ID:', data.user.id);
      return data.user;
    }

    console.log('⚠️ No user data returned');
    return null;
  } catch (err) {
    console.error('💥 Error:', err.message);
    return null;
  }
})();
