-- Auto-create a public.users row whenever someone signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (user_id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used throughout RLS policies
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Prevent a non-admin from promoting themselves or un-suspending themselves
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Only an admin can change role or status';
    end if;
  end if;
  return new;
end;
$$;

create trigger users_prevent_self_privilege_escalation
  before update on public.users
  for each row execute function public.prevent_self_privilege_escalation();

-- Keep reports.updated_at current
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

create trigger reports_touch_updated_at
  before update on public.reports
  for each row execute function public.touch_updated_at();
