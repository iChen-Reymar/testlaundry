# Supabase Setup Guide

This project uses **Supabase** (PostgreSQL + Auth + Storage) instead of MySQL/Navicat.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New project**
3. Choose a name (e.g. `laundry-connect`), set a database password, and pick a region
4. Wait for the project to finish provisioning

## 2. Run the Database Schema

1. In your Supabase project, open **SQL Editor**
2. Click **New query**
3. Open `supabase_schema.sql` from this project folder
4. Paste the full contents and click **Run**

This creates all tables, security policies, storage buckets, triggers, and sample laundry services.

## 3. Configure Environment Variables

Your `.env` file should contain:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Find these in Supabase → **Project Settings** → **API**:
- **Project URL** → `VITE_SUPABASE_URL`
- **Publishable key** (anon/public) → `VITE_SUPABASE_PUBLISHABLE_KEY`

## 4. Auth Settings (Required)

### Enable sign-ups
If you see **"Signups not allowed for this instance"**:

1. Supabase → **Authentication** → **Sign In / Providers**
2. Open **Email**
3. Turn **ON** → **Allow new users to sign up**
4. Save

### Email confirmation (recommended for development)

For easier local testing, disable email confirmation:

1. Supabase → **Authentication** → **Sign In / Providers** → **Email**
2. Turn off **Confirm email**

Users can then sign up and log in immediately without verifying email.

## 5. Deploy to Vercel (Important)

`.env` is **not** pushed to GitHub. Vercel needs the same variables set manually.

1. Vercel → your project → **Settings** → **Environment Variables**
2. Add (copy from Supabase → **Project Settings** → **API**):

| Name | Example |
|------|---------|
| `VITE_SUPABASE_URL` | `https://zqlxsnhgqmdjhjmlvicb.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` or `eyJ...` (anon key) |

3. Enable for **Production**, **Preview**, and **Development**
4. **Redeploy** (Deployments → ⋮ → Redeploy) — required because Vite bakes env vars at build time

### "Failed to fetch" on Vercel

If the browser console shows `ERR_NAME_NOT_RESOLVED` for a URL like `https://cqjrtxspbreylggebpjt.supabase.co`:

- That URL is **wrong** — DNS cannot find it
- Your Vercel `VITE_SUPABASE_URL` does not match your real Supabase project
- Fix the env var, then **redeploy** (not just save settings)

Check the Network tab: requests must go to **your** project URL from Supabase dashboard.

## 6. Start the App Locally

```bash
npm install
npm run dev:web
```

Open http://localhost:5173

The frontend talks directly to Supabase — you do **not** need to run the MySQL Express server (`npm run server`).

## 7. Create Your First Admin

1. Sign up in the app with your email
2. In Supabase → **Table Editor** → **profiles**
3. Find your row and change **role** from `customer` to `admin`
4. Log out and log back in

Or run in SQL Editor:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Users, roles, profile images (linked to Supabase Auth) |
| `customers` | Customer phone, address, booking counts |
| `staff` | Staff employee IDs and permissions |
| `services` | Laundry services and prices |
| `bookings` | All orders |
| `notifications` | In-app notifications |
| `messages` | Direct messages between users |
| `booking_ratings` | Customer ratings after completed orders |
| `user_hidden_bookings` | Orders hidden from customer history |

## Storage Buckets

| Bucket | Purpose |
|--------|---------|
| `profiles` | User profile photos |
| `services` | Service images (admin upload) |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Invalid API key` | Check `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` |
| Signup error: Signups not allowed | Authentication → Sign In / Providers → Email → enable **Allow new users to sign up** |
| `Invalid login credentials` | Sign up first (old MySQL accounts do not work), or confirm email |
| `relation "profiles" does not exist` | Run `supabase_schema.sql` in SQL Editor |
| RLS permission denied | Ensure you are logged in; check role in `profiles` |
| `Failed to fetch` on Vercel | Wrong/missing env vars — set `VITE_SUPABASE_URL` + key in Vercel, then **redeploy** |

## Migrating from MySQL/Navicat

If you had data in MySQL, export it manually and import into Supabase tables via **Table Editor** or CSV import. User passwords cannot be migrated — users must sign up again through Supabase Auth.

## Files

- `supabase_schema.sql` — Full PostgreSQL schema for Supabase
- `src/lib/supabaseClient.js` — Supabase client connection
- `src/lib/apiClient.js` — App API layer (uses Supabase)
