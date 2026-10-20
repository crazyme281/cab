-- Fix mutable search_path flagged by the security linter
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- These are internal (trigger-only or RLS-helper) functions, not meant to be called
-- directly over the API. Triggers still fire regardless of these grants.
-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default at creation time,
-- so revoke from PUBLIC directly (revoking from anon/authenticated alone isn't enough).
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.prevent_self_privilege_escalation() from public;
revoke execute on function public.is_admin() from public;

-- is_admin() is used inside RLS policies for authenticated users, so authenticated
-- must keep EXECUTE; anonymous requests never need it.
grant execute on function public.is_admin() to authenticated;
