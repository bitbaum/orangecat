# Google Maps API Setup Guide

**Created:** 2025-11-24  
**Last Modified:** 2025-11-24  
**Last Modified Summary:** Setup instructions for Google Places Autocomplete

---

## 🎯 Purpose

Enable Google Places Autocomplete for location entry in profile forms. This provides the best global UX with minimal friction.

---

## 📋 Prerequisites

- Google Cloud account (free tier available)
- Billing account (required, but won't charge at your scale)

---

## 🚀 Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it "OrangeCat" (or your preference)
4. Click "Create"

### 2. Enable Required APIs

1. In the project, go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Places API** (for autocomplete)
   - **Maps JavaScript API** (for Places service)

### 3. Create API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"API Key"**
3. Copy the API key
4. **Important:** Click "Restrict Key" and:
   - Under "API restrictions", select "Restrict key"
   - Choose: "Places API" and "Maps JavaScript API"
   - Under "Application restrictions", select "HTTP referrers"
   - Add: `http://localhost:3000/*` (for development)
   - Add: `https://*.orangecat.ch/*` (for production)

### 4. Add to Environment Variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### 5. Restart Dev Server

```bash
pnpm run dev
```

---

## 💰 Cost Management

### At Your Scale (<100 requests/month)

- **Autocomplete:** FREE
- **Place Details:** ~$0.017 per request
- **Monthly cost:** ~$1.70 (effectively free)

### Set Up Billing Alerts

1. Go to **Billing** → **Budgets & alerts**
2. Create budget alert for $5/month
3. This ensures you're notified if usage spikes

---

## ✅ Verification

After setup, test in browser:

1. Go to `/dashboard/info/edit`
2. Click location field
3. Type "Zurich" or "8053"
4. Should see Google Places suggestions instantly

---

## 🔧 Troubleshooting

### "Google Maps API key not found"

- Check `.env.local` has `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Restart dev server after adding env var
- Check API key restrictions allow your domain

### "This API project is not authorized"

- Enable "Places API" and "Maps JavaScript API" in Google Cloud Console
- Wait 5-10 minutes for changes to propagate

### No suggestions appearing

- Check browser console for errors
- Verify API key restrictions allow your domain
- Check billing is enabled (required even for free tier)

---

## 📚 References

- [Google Places API Docs](https://developers.google.com/maps/documentation/places/web-service)
- [Pricing Information](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
