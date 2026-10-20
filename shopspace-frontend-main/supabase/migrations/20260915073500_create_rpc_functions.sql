-- ===== User-facing (security invoker, RLS still applies) =====

create or replace function public.get_conversations()
returns table (
  other_user_id uuid,
  other_full_name text,
  other_avatar_url text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint,
  product_id bigint,
  product_title text,
  product_image_url text
)
language sql
stable
set search_path = public
as $$
  with mine as (
    select m.*,
      case when m.sender_id = auth.uid() then m.receiver_id else m.sender_id end as other_id
    from public.messages m
    where m.sender_id = auth.uid() or m.receiver_id = auth.uid()
  ),
  ranked as (
    select mine.*, row_number() over (partition by other_id order by created_at desc) as rn
    from mine
  ),
  unread as (
    select other_id, count(*) as cnt
    from mine
    where receiver_id = auth.uid() and is_read = false
    group by other_id
  )
  select
    r.other_id,
    u.full_name,
    u.profile_image,
    r.message_text,
    r.created_at,
    coalesce(un.cnt, 0),
    r.product_id,
    p.title,
    p.image_url
  from ranked r
  join public.users u on u.user_id = r.other_id
  left join public.products p on p.product_id = r.product_id
  left join unread un on un.other_id = r.other_id
  where r.rn = 1
  order by r.created_at desc;
$$;
revoke execute on function public.get_conversations() from public;
grant execute on function public.get_conversations() to authenticated;

create or replace function public.get_favorites()
returns table (
  favorite_id bigint,
  product_id bigint,
  title text,
  price text,
  image_url text,
  condition text,
  status text,
  category_name text,
  seller_name text
)
language sql
stable
set search_path = public
as $$
  select f.favorite_id, p.product_id, p.title, p.price::text, p.image_url, p.condition, p.status,
         c.name, u.full_name
  from public.favorites f
  join public.products p on p.product_id = f.product_id
  join public.categories c on c.category_id = p.category_id
  join public.users u on u.user_id = p.seller_id
  where f.user_id = auth.uid()
  order by f.created_at desc;
$$;
revoke execute on function public.get_favorites() from public;
grant execute on function public.get_favorites() to authenticated;

-- View counting: bypasses "only the seller can update their own listing" so that
-- any visitor's view increments the seller's count. Anon may call this too.
create or replace function public.increment_product_view(p_product_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products set view_count = view_count + 1 where product_id = p_product_id;
end;
$$;
revoke execute on function public.increment_product_view(bigint) from public;
grant execute on function public.increment_product_view(bigint) to anon, authenticated;

-- ===== Admin-only (security definer + explicit admin check) =====

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select jsonb_build_object(
    'total_students', (select count(*) from public.users where role = 'user'),
    'active_students', (select count(*) from public.users where role = 'user' and status = 'active'),
    'active_sellers', (select count(distinct seller_id) from public.products where approval_status = 'approved' and status = 'available'),
    'total_listings', (select count(*) from public.products),
    'pending_approvals', (select count(*) from public.products where approval_status = 'pending'),
    'reported_products', (select count(distinct reported_product_id) from public.reports where reported_product_id is not null and status in ('new','under_review')),
    'reported_users', (select count(distinct reported_user_id) from public.reports where reported_user_id is not null and status in ('new','under_review')),
    'open_disputes', (select count(*) from public.reports where status in ('new','under_review')),
    'suspended_users', (select count(*) from public.users where status = 'suspended'),
    'recent_users', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select user_id, full_name, email, created_at from public.users order by created_at desc limit 5
    ) x),
    'recent_products', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select product_id, title, approval_status, created_at from public.products order by created_at desc limit 5
    ) x),
    'most_viewed_products', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select product_id, title, view_count from public.products order by view_count desc limit 5
    ) x),
    'most_active_sellers', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select u.user_id, u.full_name, count(p.product_id) as listing_count
      from public.users u join public.products p on p.seller_id = u.user_id
      group by u.user_id, u.full_name order by listing_count desc limit 5
    ) x),
    'most_active_categories', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select c.name, count(p.product_id) as listing_count
      from public.categories c join public.products p on p.category_id = c.category_id
      group by c.name order by listing_count desc limit 5
    ) x),
    'recent_admin_actions', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select log_id, action, target_type, target_id, created_at from public.audit_logs order by created_at desc limit 10
    ) x)
  ) into result;

  return result;
end;
$$;
revoke execute on function public.admin_dashboard() from public;
grant execute on function public.admin_dashboard() to authenticated;

create or replace function public.admin_search_products(search text default null, approval_filter text default null)
returns table (
  product_id bigint, title text, price text, status text, approval_status text,
  rejection_reason text, featured boolean, view_count bigint, image_url text,
  category_name text, seller_name text, seller_email text, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  return query
  select p.product_id, p.title, p.price::text, p.status, p.approval_status,
         p.rejection_reason, p.featured, p.view_count, p.image_url,
         c.name, u.full_name, u.email, p.created_at
  from public.products p
  join public.categories c on c.category_id = p.category_id
  join public.users u on u.user_id = p.seller_id
  where (search is null or p.title ilike '%' || search || '%')
    and (approval_filter is null or p.approval_status = approval_filter)
  order by p.created_at desc;
end;
$$;
revoke execute on function public.admin_search_products(text, text) from public;
grant execute on function public.admin_search_products(text, text) to authenticated;

create or replace function public.admin_set_product_approval(p_product_id bigint, p_approval_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before jsonb;
  after jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select to_jsonb(p) into before from public.products p where product_id = p_product_id;

  update public.products
  set approval_status = p_approval_status,
      rejection_reason = case when p_approval_status in ('rejected','removed') then p_reason else null end
  where product_id = p_product_id
  returning to_jsonb(products) into after;

  insert into public.audit_logs (admin_id, action, target_type, target_id, reason, previous_state, new_state)
  values (auth.uid(), 'set_product_approval', 'product', p_product_id::text, p_reason, before, after);
end;
$$;
revoke execute on function public.admin_set_product_approval(bigint, text, text) from public;
grant execute on function public.admin_set_product_approval(bigint, text, text) to authenticated;

create or replace function public.admin_set_product_featured(p_product_id bigint, p_featured boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public.products set featured = p_featured where product_id = p_product_id;

  insert into public.audit_logs (admin_id, action, target_type, target_id, new_state)
  values (auth.uid(), 'set_product_featured', 'product', p_product_id::text, jsonb_build_object('featured', p_featured));
end;
$$;
revoke execute on function public.admin_set_product_featured(bigint, boolean) from public;
grant execute on function public.admin_set_product_featured(bigint, boolean) to authenticated;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before jsonb;
  after jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select to_jsonb(u) into before from public.users u where user_id = p_user_id;

  update public.users set status = p_status where user_id = p_user_id
  returning to_jsonb(users) into after;

  insert into public.audit_logs (admin_id, action, target_type, target_id, previous_state, new_state)
  values (auth.uid(), 'set_user_status', 'user', p_user_id::text, before, after);
end;
$$;
revoke execute on function public.admin_set_user_status(uuid, text) from public;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

create or replace function public.admin_warn_user(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  insert into public.user_warnings (user_id, admin_id, reason) values (p_user_id, auth.uid(), p_reason);

  insert into public.audit_logs (admin_id, action, target_type, target_id, reason)
  values (auth.uid(), 'warn_user', 'user', p_user_id::text, p_reason);
end;
$$;
revoke execute on function public.admin_warn_user(uuid, text) from public;
grant execute on function public.admin_warn_user(uuid, text) to authenticated;

create or replace function public.admin_add_note(p_user_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  insert into public.admin_notes (user_id, admin_id, note) values (p_user_id, auth.uid(), p_note);
end;
$$;
revoke execute on function public.admin_add_note(uuid, text) from public;
grant execute on function public.admin_add_note(uuid, text) to authenticated;

create or replace function public.admin_list_reports(status_filter text default null)
returns table (
  report_id bigint, category text, description text, evidence_url text, status text,
  decision text, resolution_notes text, created_at timestamptz,
  reporter_id uuid, reporter_name text,
  reported_user_id uuid, reported_user_name text,
  reported_product_id bigint, reported_product_title text,
  reported_review_id bigint, reported_review_comment text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  return query
  select r.report_id, r.category, r.description, r.evidence_url, r.status,
         r.decision, r.resolution_notes, r.created_at,
         r.reporter_id, reporter.full_name,
         r.reported_user_id, ru.full_name,
         r.reported_product_id, p.title,
         r.reported_review_id, rv.comment
  from public.reports r
  join public.users reporter on reporter.user_id = r.reporter_id
  left join public.users ru on ru.user_id = r.reported_user_id
  left join public.products p on p.product_id = r.reported_product_id
  left join public.reviews rv on rv.review_id = r.reported_review_id
  where status_filter is null or r.status = status_filter
  order by r.created_at desc;
end;
$$;
revoke execute on function public.admin_list_reports(text) from public;
grant execute on function public.admin_list_reports(text) to authenticated;

create or replace function public.admin_resolve_report(p_report_id bigint, p_status text, p_resolution_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public.reports
  set status = p_status, resolution_notes = p_resolution_notes,
      decision = p_status, assigned_admin_id = auth.uid()
  where report_id = p_report_id;

  insert into public.audit_logs (admin_id, action, target_type, target_id, reason)
  values (auth.uid(), 'resolve_report', 'report', p_report_id::text, p_resolution_notes);
end;
$$;
revoke execute on function public.admin_resolve_report(bigint, text, text) from public;
grant execute on function public.admin_resolve_report(bigint, text, text) to authenticated;

create or replace function public.admin_delete_review(p_review_id bigint, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  before jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select to_jsonb(rv) into before from public.reviews rv where review_id = p_review_id;

  delete from public.reviews where review_id = p_review_id;

  insert into public.audit_logs (admin_id, action, target_type, target_id, reason, previous_state)
  values (auth.uid(), 'delete_review', 'review', p_review_id::text, p_reason, before);
end;
$$;
revoke execute on function public.admin_delete_review(bigint, text) from public;
grant execute on function public.admin_delete_review(bigint, text) to authenticated;
