# 🚀 OrangeCat OAuth Provider Setup Guide

This guide will help you configure GitHub, Google, and Twitter/X OAuth providers for OrangeCat authentication.

## ⚠️ Prerequisites

1. **Supabase Account**: You need access to your Supabase project dashboard
2. **GitHub Account**: For creating GitHub OAuth app
3. **Google Account**: For creating Google OAuth credentials
4. **Twitter/X Account**: For creating Twitter/X OAuth app

---

## 📋 Step 1: Access Supabase Studio

(Managed Supabase Cloud retired 2026-06 — DB is now self-hosted at supabase.orangecat.ch on the Hetzner box; access via the box / founder.)

1. **Open Studio** on the self-hosted instance
2. **Go to**: Settings → Authentication → Providers

You should see a screen like this:

![Supabase Auth Providers](https://via.placeholder.com/800x400?text=Supabase+Auth+Providers+Screen)

---

## 📋 Step 2: Enable OAuth Providers in Supabase

In your Supabase dashboard, enable these providers:

### ✅ GitHub Provider

- **Toggle**: ON
- **Client ID**: `your-github-client-id` (you'll get this from GitHub)
- **Client Secret**: `your-github-client-secret` (you'll get this from GitHub)

### ✅ Google Provider

- **Toggle**: ON
- **Client ID**: `your-google-client-id` (you'll get this from Google)
- **Client Secret**: `your-google-client-secret` (you'll get this from Google)

### ✅ Twitter/X Provider

- **Toggle**: ON
- **Client ID**: `your-twitter-client-id` (you'll get this from Twitter/X)
- **Client Secret**: `your-twitter-client-secret` (you'll get this from Twitter/X)

**Important**: Set the **Redirect URL** to: `https://www.orangecat.ch/auth/callback`

---

## 📋 Step 3: Create GitHub OAuth Application

1. **Go to**: https://github.com/settings/applications/new
2. **Fill in the form**:
   - **Application name**: `OrangeCat`
   - **Homepage URL**: `https://www.orangecat.ch`
   - **Application description**: `OrangeCat Bitcoin Crowdfunding Platform`
   - **Authorization callback URL**: `https://www.orangecat.ch/auth/callback`

3. **Click "Register application"**

4. **Copy the Client ID and Client Secret** from the next screen

![GitHub OAuth App Creation](https://via.placeholder.com/800x400?text=GitHub+OAuth+App+Creation)

---

## 📋 Step 4: Create Google OAuth Credentials

1. **Go to**: https://console.cloud.google.com/
2. **Select or create a project**
3. **Enable Google+ API**:
   - Go to APIs & Services → Library
   - Search for "Google+ API"
   - Click "Enable"

4. **Create OAuth 2.0 Client ID**:
   - Go to APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - **Application type**: Web application
   - **Name**: `OrangeCat`
   - **Authorized redirect URIs**: `https://www.orangecat.ch/auth/callback`

5. **Copy the Client ID and Client Secret**

![Google OAuth Credentials](https://via.placeholder.com/800x400?text=Google+OAuth+Credentials)

---

## 📋 Step 5: Create Twitter/X OAuth Application

1. **Go to**: https://developer.twitter.com/en/portal/dashboard
2. **Create a new app**:
   - **App name**: `OrangeCat`
   - **Application description**: `OrangeCat Bitcoin Crowdfunding Platform`
   - **Use case**: `Crowdfunding platform`

3. **Configure authentication**:
   - **App permissions**: Read
   - **Type of app**: Web App
   - **Callback URLs**: `https://www.orangecat.ch/auth/callback`
   - **Website URL**: `https://www.orangecat.ch`

4. **Enable OAuth 2.0** in Authentication settings

5. **Copy the API Key (Client ID) and API Key Secret (Client Secret)**

![Twitter/X OAuth App](https://via.placeholder.com/800x400?text=Twitter+X+OAuth+App)

---

## 📋 Step 6: Update .env.local File

Open your `.env.local` file and replace the placeholder values:

```bash
# GitHub OAuth (Required for GitHub login)
SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=your-actual-github-client-id
SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=your-actual-github-client-secret

# Google OAuth (Required for Google login)
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-actual-google-client-id
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-actual-google-client-secret

# X/Twitter OAuth (Required for Twitter/X login)
SUPABASE_AUTH_EXTERNAL_TWITTER_CLIENT_ID=your-actual-twitter-client-id
SUPABASE_AUTH_EXTERNAL_TWITTER_SECRET=your-actual-twitter-client-secret
```

---

## 📋 Step 7: Restart Development Server

```bash
pnpm run dev
```

---

## 📋 Step 8: Test Authentication

1. **Go to**: https://orangecat.ch/auth
2. **You should now see** the social login buttons:
   - Continue with GitHub
   - Continue with Google
   - Continue with X (Twitter)

3. **Click each button** and verify they redirect to the OAuth provider
4. **Complete the OAuth flow** and verify users can authenticate

---

## 🎯 Troubleshooting

### ❌ "Provider is not enabled" Error

**Solution**: Go back to Supabase Dashboard → Authentication → Providers and ensure all three providers are enabled.

### ❌ "Invalid redirect URL" Error

**Solution**: Make sure the redirect URL in Supabase matches exactly: `https://www.orangecat.ch/auth/callback`

### ❌ "Invalid client credentials" Error

**Solution**: Double-check that the Client ID and Secret in `.env.local` match exactly what you copied from each OAuth provider.

### ❌ Social login buttons not showing

**Solution**:

1. Check browser console for errors
2. Verify all OAuth providers are enabled in Supabase
3. Check that `.env.local` has valid credentials
4. Restart the development server

---

## 🔧 Environment Variables Reference

Your `.env.local` should look like this (with real values):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://supabase.orangecat.ch
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# OAuth Provider Configuration
SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=github-client-id-here
SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=github-client-secret-here
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=google-client-id-here
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=google-client-secret-here
SUPABASE_AUTH_EXTERNAL_TWITTER_CLIENT_ID=twitter-client-id-here
SUPABASE_AUTH_EXTERNAL_TWITTER_SECRET=twitter-client-secret-here
```

---

## 🚨 Security Notes

1. **Never commit `.env.local`** to version control
2. **Use different credentials** for development and production
3. **Rotate credentials regularly** for security
4. **Monitor your OAuth applications** for unauthorized access

---

## ✅ Verification Checklist

- [ ] GitHub OAuth app created and configured
- [ ] Google OAuth credentials created and configured
- [ ] Twitter/X OAuth app created and configured
- [ ] All providers enabled in Supabase Dashboard
- [ ] Redirect URL set to `https://www.orangecat.ch/auth/callback`
- [ ] `.env.local` updated with real credentials
- [ ] Development server restarted
- [ ] Social login buttons visible at `/auth`
- [ ] OAuth flows work end-to-end

---

## 🎉 Success!

Once you've completed all the steps above, OrangeCat will have fully functional OAuth authentication with GitHub, Google, and Twitter/X. Users will be able to sign in using any of these providers, and the authentication will work seamlessly with the rest of the platform.
