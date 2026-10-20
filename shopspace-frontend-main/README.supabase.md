# ShopSpace — now Supabase-only (no backend)

This app talks directly to Supabase (project
`yjiinntoklpepnjsdijv`) using `@supabase/supabase-js`. The old
Express/Node backend has been removed.

## What changed

- **Auth**: now Supabase Auth (`supabase.auth.signUp` /
  `signInWithPassword`) instead of custom JWT + bcrypt. A database
  trigger (`handle_new_user`) auto-creates a row in `public.users`
  whenever someone signs up.
- **Data access**: pages call `supabase.from('table')...` directly.
  Security is enforced by **Row Level Security** policies on every
  table (not application code) — e.g. you can only edit your own
  listings, only participants can see a chat thread, only admins can
  suspend a user.
- **Complex queries** (conversation list, admin stats, admin listing
  search) are Postgres functions called via `supabase.rpc(...)`,
  since they need joins/aggregates PostgREST can't express directly.
- **Image uploads**: now go to **Supabase Storage** (`product-images`
  bucket) instead of Cloudinary — Cloudinary's API secret can't safely
  live in a frontend-only app.
- User ids are now UUIDs (Supabase Auth ids) instead of integers.

## Setup

1. `.env` already has your project URL and anon/publishable key —
   both are safe to expose client-side; RLS does the actual
   enforcement.
2. `npm install`
3. `npm run dev`

## Making yourself an admin

There's no signup flow for admins (by design). After creating your
account normally, promote it from the Supabase SQL editor:

```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

## Notes

- RLS is enabled on every table; policies live in the migration that
  was applied to the project (ask if you'd like a copy of the SQL).
- The `product-images` storage bucket is public-read, authenticated-write.
