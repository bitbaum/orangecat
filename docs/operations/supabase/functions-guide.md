# Supabase Edge Functions

This directory contains Supabase Edge Functions to help with various aspects of the application.

## CORS Proxy

The `cors-proxy` Edge Function is a solution to CORS issues when making authenticated requests to Supabase. It works by proxying requests through a serverless function that adds the proper CORS headers.

### Why is this needed?

When making authenticated requests with `credentials: 'include'` mode, browsers require specific CORS headers from the server:

- `Access-Control-Allow-Origin` cannot be a wildcard (`*`) and must specify the exact origin
- `Access-Control-Allow-Credentials` must be set to `true`

Some Supabase endpoints may respond with a wildcard, causing CORS errors.

### How to deploy

1. Make sure you have the Supabase CLI installed:

   ```
   pnpm add -g supabase
   ```

2. Log in to Supabase CLI:

   ```
   supabase login
   ```

3. Deploy the function (from the project root):

   ```
   ./scripts/deploy-cors-proxy.sh
   ```

   Or manually:

   ```
   supabase functions deploy cors-proxy --project-ref your-project-ref
   ```

4. Set the required environment variables:

   ```
   supabase secrets set SUPABASE_URL="your-supabase-url" SUPABASE_ANON_KEY="your-supabase-anon-key" --project-ref your-project-ref
   ```

5. Add the CORS proxy URL to your `.env.local` file:
   ```
   NEXT_PUBLIC_CORS_PROXY_URL=https://supabase.orangecat.ch/functions/v1/cors-proxy
   ```

### How it works

1. Auth-related requests are detected in the Supabase client
2. Instead of making the request directly to Supabase, the client redirects the request to the Edge Function
3. The Edge Function makes the request to Supabase on behalf of the client
4. The Edge Function adds the proper CORS headers to the response
5. The response is returned to the client with the proper CORS headers

### Testing

You can test the CORS proxy with:

```
curl -X GET "https://supabase.orangecat.ch/functions/v1/cors-proxy?path=/rest/v1/health"
```
