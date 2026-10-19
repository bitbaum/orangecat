---
created_date: 2025-06-05
last_modified_date: 2025-08-25
last_modified_summary: Document password reset (recovery) flow and production redirect configuration
---

# 🔐 Authentication System Detailed Guide

This document provides a comprehensive overview of the authentication and user profile management system in this application. It leverages Supabase for backend services and Zustand for client-side state management.

## 1. Core Technologies

- **Supabase Auth:** Provides secure user authentication (email/password, social logins if configured), JWT-based session management, and user identity storage in the `auth.users` table.
- **Supabase Database (PostgreSQL):** Hosts the `public.profiles` table, which stores additional user information beyond what `auth.users` provides.
- **Next.js Middleware:** Used for protecting routes at the edge, redirecting unauthenticated users.
- **Zustand:** For managing global client-side authentication state (user, session, profile, loading status).
- **TypeScript:** Ensures type safety throughout the authentication flow and data handling.

## 2. Authentication Flow

### 2.1. User Sign-Up

1.  User provides email and password.
2.  The `signUp` method in `src/stores/auth.ts` is called.
3.  `supabase.auth.signUp()` is invoked:
    - Creates a new user in the `auth.users` table.
    - Sends a confirmation email (if email confirmations are enabled in Supabase).
4.  **Profile Creation:** Immediately after successful sign-up in `auth.users`, the `signUp` method in `src/stores/auth.ts` also:
    - Constructs a new profile object.
    - Populates initial fields:
      - `id`: Matches the `auth.users.id`.
      - `username`: Derived from the email prefix.
      - `display_name`: Also derived from the email prefix.
      - `avatar_url`: `null` by default.
      - `bio`: `null` by default.
      - `bitcoin_address`: `null` by default.
      - `created_at` & `updated_at`: Current timestamp.
    - Inserts this new record into the `public.profiles` table.
5.  The `onAuthStateChange` listener in `src/stores/auth.ts` will eventually fire with a `SIGNED_IN` event (or `USER_ADDED` depending on Supabase config), triggering a profile fetch and state update.

### 2.2. User Log-In

1.  User provides email and password.
2.  The `signIn` method in `src/stores/auth.ts` is called.
3.  `supabase.auth.signInWithPassword()` is invoked.
4.  Supabase validates credentials and, if successful, establishes a session and issues a JWT.
5.  The `onAuthStateChange` listener in `src/stores/auth.ts` fires with a `SIGNED_IN` event.
6.  The listener updates the Zustand store with the `user` and `session` objects.
7.  It then asynchronously fetches the user's corresponding profile from the `public.profiles` table using the `user.id`.
8.  The fetched `profile` data is also updated in the Zustand store.
9.  Client-side UI reacts to the updated state (e.g., redirecting to a dashboard, showing user-specific content).

### 2.3. User Log-Out

1.  User initiates logout (e.g., clicks a logout button).
2.  The `signOut` method in `src/stores/auth.ts` is called.
3.  `supabase.auth.signOut()` is invoked.
4.  Supabase invalidates the current session and clears relevant auth cookies/storage.
5.  The `onAuthStateChange` listener in `src/stores/auth.ts` fires with a `SIGNED_OUT` event.
6.  The listener clears `user`, `session`, and `profile` data in the Zustand store.
7.  UI reacts, typically redirecting to a public page (e.g., homepage or login page).

### 2.4. Session Management & Route Protection

- **Next.js Middleware (`src/middleware.ts`):**
  - Intercepts requests to protected routes.
  - Uses `@supabase/ssr`'s `createServerClient` to check for a valid session from cookies.
  - If no session, redirects to `/auth`.
  - Handles sign-out URL (`/auth/signout`).
- **Client-Side Hooks (`src/hooks/useAuth.ts`):**
  - `useRequireAuth()`: For client-side components/pages. If no authenticated user (after hydration), redirects to `/auth`.
  - `useRedirectIfAuthenticated()`: If an authenticated user visits a page like `/auth`, redirects them to `/dashboard`.
- **Zustand Store Hydration:**
  - The store is persisted to `localStorage`.
  - On app load, the `onAuthStateChange` listener (with `INITIAL_SESSION` event) and persisted state help rehydrate the auth status quickly.
  - `hydrated` and `isLoading` flags in the store are crucial for UI to prevent flicker and show appropriate loading states.

### 2.5. Password Reset (Recovery) Flow

- Initiation: `resetPassword({ email })` in `src/services/supabase/auth/index.ts` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
  - `redirectTo` must be a fully-qualified URL to the reset page, e.g., `https://www.orangecat.ch/auth/reset-password`.
  - In production, `NEXT_PUBLIC_SITE_URL` must be set to the canonical domain used in Supabase (see configuration below). The service constructs `redirectTo` as `${NEXT_PUBLIC_SITE_URL}/auth/reset-password`.
- Email: Supabase generates `{{ .ConfirmationURL }}` which includes the tokens (often in the URL hash fragment) and sends it using our template `supabase/templates/recovery.html`.
- Redirect handling:
  - For valid links, Supabase should redirect directly to `/auth/reset-password` on the same domain as `redirectTo`.
  - For expired/invalid links, Supabase may fall back to the configured `site_url` root and append error query parameters (e.g., `?error=access_denied&error_code=otp_expired`).
  - Middleware at `src/middleware.ts` now preserves such error parameters and redirects from `/` to `/auth/reset-password`, keeping both query and any client-side hash intact (when available in the browser).
- Reset page: `src/app/auth/reset-password/page.tsx` merges tokens from both query string and hash fragment, then calls `supabase.auth.setSession({ access_token, refresh_token })` before allowing the password update.

Configuration requirements (Production):

- Supabase Project Settings → Authentication → URL Configuration:
  - Set `site_url` to the canonical domain (choose one): `https://www.orangecat.ch` or `https://orangecat.ch`.
  - Add ALL of the following to Additional Redirect URLs (exact match required):
    - `https://www.orangecat.ch/auth/reset-password`
    - `https://orangecat.ch/auth/reset-password`
    - (Optional for dev): `http://localhost:3000/auth/reset-password`
- Production Environment Variables (`/opt/orangecat/app/.env` on the Hetzner box):
  - Set `NEXT_PUBLIC_SITE_URL` to the SAME canonical domain used for `site_url` above (e.g., `https://www.orangecat.ch`).
  - This ensures the `redirectTo` generated server-side matches the allow-list in Supabase exactly.
- Notes:
  - If `redirectTo` is not exactly on the allow-list, Supabase will reject it and fall back to `site_url` with error parameters, causing a redirect to the homepage.
  - Browsers do not send URL hash fragments to the server. Our client page reads both query and hash; middleware can only act on query params.

## 3. State Management (`src/stores/auth.ts`)

- **`useAuthStore` (Zustand):** Single source of truth for client-side authentication state.
  - `user: User | null`: The Supabase `User` object.
  - `session: Session | null`: The Supabase `Session` object.
  - `profile: Profile | null`: The user's custom profile data from the `profiles` table (typed by `Profile` from `src/types/database.ts`).
  - `isLoading: boolean`: Indicates if an auth operation or profile fetch is in progress.
  - `hydrated: boolean`: Indicates if the store has been rehydrated from `localStorage` and initial session check is complete.
  - `isAdmin: boolean`: Derived from `user?.app_metadata?.role`.
  - `error: string | null`: Stores any error messages from auth operations.
- **`onAuthStateChange` Listener:**
  - Listens to Supabase auth events (`SIGNED_IN`, `SIGNED_OUT`, `USER_UPDATED`, `INITIAL_SESSION`, etc.).
  - Updates the store accordingly, including fetching/clearing the user profile.
  - This is the primary mechanism for keeping the client-side state in sync with Supabase's auth state.

## 4. User Profiles

### 4.1. Profile Data Structure

The structure of user profiles is defined by the `Profile` interface in `src/types/database.ts`. This should mirror the schema of the `public.profiles` table in Supabase.

```typescript
// From: src/types/database.ts
export interface Profile {
  id: string; // Primary key, matches auth.users.id
  username?: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  bio: string | null;
  bitcoin_address: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}
```

### 4.2. Link to `auth.users`

- The `profiles.id` column is the primary key and is a foreign key referencing `auth.users.id`. This establishes a one-to-one relationship.

### 4.3. Profile Creation and Updates

- **Creation:** As detailed in the "User Sign-Up" flow, a profile is automatically created in `public.profiles` when a new user signs up via `src/stores/auth.ts`.
- **Updates:**
  - Users can update their profile information through UI elements.
  - The `updateProfile` method in `src/stores/auth.ts` is called.
  - This method, in turn, may call `ProfileService.updateProfile` (or directly use the Supabase client as it currently does).
  - The service/store updates the relevant row in the `public.profiles` table using the user's ID.
  - After a successful update, the local `profile` state in the Zustand store is also updated.

## 5. Database Interaction (`public.profiles` Table)

- **Schema Consistency:** It is **critical** that the columns and data types in your `public.profiles` table in Supabase **exactly match** the `Profile` interface in `src/types/database.ts`. Mismatches will lead to runtime errors.
- **Row Level Security (RLS):**
  - RLS should be enabled on the `public.profiles` table.
  - **Recommended Policies:**
    - Users can only select their own profile:
      `CREATE POLICY "Enable read access for own user" ON public.profiles FOR SELECT USING (auth.uid() = id);`
    - Users can only update their own profile:
      `CREATE POLICY "Enable update access for own user" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);`
    - Profile creation is handled by the application logic after user sign-up (often using service_role key implicitly via `supabase.auth.signUp` context or explicit service client if profile creation is separate and secured). For client-side initiated profile inserts linked to new users, ensure the RLS policy for INSERT allows it only if `id` matches `auth.uid()`.
      `CREATE POLICY "Enable insert for own user" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);`

### 5.1. Cascading Deletes (Important Setup)

By default, deleting a user from `auth.users` (e.g., via Supabase dashboard or admin SDK) **will not** automatically delete their corresponding row in `public.profiles`. This leaves orphaned profile data.

To enable automatic cascading deletes:

1.  **Create a Database Function:** Execute this in the Supabase SQL Editor:

    ```sql
    CREATE OR REPLACE FUNCTION public.handle_user_delete()
    RETURNS TRIGGER AS $$
    BEGIN
      DELETE FROM public.profiles
      WHERE id = OLD.id; -- OLD.id refers to the id of the user being deleted
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    ```

    _(Note: `SECURITY DEFINER` allows the function to run with the permissions of the user who defined it, which is necessary to delete from `public.profiles` if restrictive RLS is in place for the calling user.)_

2.  **Create a Trigger on `auth.users`:** Execute this in the Supabase SQL Editor:
    ```sql
    CREATE TRIGGER on_auth_user_deleted
      AFTER DELETE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();
    ```
    This ensures that whenever a user is deleted from `auth.users`, their associated profile in `public.profiles` is also deleted.

## 6. Key Files & Responsibilities

- **`src/stores/auth.ts`:** Central Zustand store for auth state, sign-in/up/out methods, `onAuthStateChange` listener.
- **`src/types/database.ts`:** Defines the `Profile` interface (and `ProfileFormData`). Single source of truth for profile structure.
- **`src/hooks/useAuth.ts`:** Provides convenient hooks (`useAuth`, `useRequireAuth`, `useRedirectIfAuthenticated`) for accessing auth state and managing route protection on the client side.
- **`src/middleware.ts`:** Next.js middleware for edge-based route protection.
- **`src/services/profile/`:** Profile reads (`reader.ts`) and writes (`writer.ts`); some operations are still direct in the store.
- **`src/lib/supabase/browser.ts`:** The Supabase browser client.
- **`docs/security/auth_system.md` (this file):** Detailed documentation.

## 7. Maintainability & Best Practices

- **Type Safety:** The unified `Profile` type is crucial. Ensure it always reflects the database schema.
- **RLS:** Keep Row Level Security policies on Supabase tables strict and well-tested.
- **Error Handling:** Ensure robust error handling in async operations within the store and services.
- **Single Responsibility:** Consider refining services so that `ProfileService.ts` becomes the sole handler of all direct `profiles` table interactions, which the store would then use.
- **Keep Documentation Updated:** As the authentication system evolves, update this document.

This detailed guide should help current and future developers understand the intricacies of the authentication system.
