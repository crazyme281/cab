-- Hardening pass found while reviewing the app.
--
-- Row-level security decides WHICH rows a user may touch, but not WHICH COLUMNS
-- they may change. These triggers close the gaps where a normal signed-in user
-- could call the API directly (bypassing the app's UI) and:
--   * approve their own listing, feature it, or fake its view count
--   * insert a "transaction" with another seller / an invented price
--   * review someone who was never part of the deal, or review an unfinished deal
--   * rewrite the text of a chat message they received
--   * upload files into another user's storage folder
--
-- Every guard only applies to direct API calls (role `authenticated`) made by a
-- non-admin. The admin RPCs and increment_product_view are SECURITY DEFINER, so
-- they run as the function owner and are not affected.

-- ---------------------------------------------------------------- products
create or replace function public.guard_product_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approval_status := 'pending';
    new.rejection_reason := null;
    new.featured := false;
    new.view_count := 0;
    return new;
  end if;

  -- UPDATE: sellers may edit content and mark sold/available, nothing moderation-related
  new.seller_id := old.seller_id;
  new.created_at := old.created_at;
  new.featured := old.featured;
  new.view_count := old.view_count;
  new.approval_status := old.approval_status;
  new.rejection_reason := old.rejection_reason;

  -- Changing what buyers actually see sends an approved or rejected listing
  -- back to the admin queue (a rejected listing could otherwise never be fixed).
  if old.approval_status in ('approved', 'rejected') and (
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.image_url is distinct from old.image_url
    or new.category_id is distinct from old.category_id
  ) then
    new.approval_status := 'pending';
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_product_write() from public;

drop trigger if exists products_guard_write on public.products;
create trigger products_guard_write
  before insert or update on public.products
  for each row execute function public.guard_product_write();

-- ------------------------------------------------------------ transactions
create or replace function public.guard_transaction_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  prod record;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select seller_id, price, status, approval_status
      into prod
      from public.products
     where product_id = new.product_id;

    if not found or prod.approval_status <> 'approved' or prod.status <> 'available' then
      raise exception 'This item is not available to buy';
    end if;
    if prod.seller_id = auth.uid() then
      raise exception 'You cannot buy your own item';
    end if;

    -- Never trust the client for these
    new.buyer_id := auth.uid();
    new.seller_id := prod.seller_id;
    new.agreed_price := prod.price;
    new.status := 'pending';
    return new;
  end if;

  -- UPDATE
  if new.product_id is distinct from old.product_id
     or new.buyer_id is distinct from old.buyer_id
     or new.seller_id is distinct from old.seller_id
     or new.agreed_price is distinct from old.agreed_price
     or new.created_at is distinct from old.created_at then
    raise exception 'Transaction details cannot be changed';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' then
      raise exception 'This transaction is already % and cannot be changed', old.status;
    end if;
    if new.status not in ('completed', 'cancelled') then
      raise exception 'Invalid transaction status';
    end if;
    if new.status = 'completed' and auth.uid() <> old.seller_id then
      raise exception 'Only the seller can confirm a sale';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_transaction_write() from public;

drop trigger if exists transactions_guard_write on public.transactions;
create trigger transactions_guard_write
  before insert or update on public.transactions
  for each row execute function public.guard_transaction_write();

-- ----------------------------------------------------------------- reviews
create or replace function public.guard_review_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  t record;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- an author may reword their review, not re-point it at someone else
    new.transaction_id := old.transaction_id;
    new.reviewer_id := old.reviewer_id;
    new.reviewee_id := old.reviewee_id;
    new.created_at := old.created_at;
    return new;
  end if;

  select buyer_id, seller_id, status
    into t
    from public.transactions
   where transaction_id = new.transaction_id;

  if not found then
    raise exception 'Transaction not found';
  end if;
  if t.status <> 'completed' then
    raise exception 'Only completed transactions can be reviewed';
  end if;

  if new.reviewer_id = t.buyer_id then
    new.reviewee_id := t.seller_id;
  elsif new.reviewer_id = t.seller_id then
    new.reviewee_id := t.buyer_id;
  else
    raise exception 'Only the buyer or the seller can leave a review';
  end if;

  if exists (
    select 1 from public.reviews r
     where r.transaction_id = new.transaction_id
       and r.reviewer_id = new.reviewer_id
  ) then
    raise exception 'You have already reviewed this transaction';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_review_write() from public;

drop trigger if exists reviews_guard_write on public.reviews;
create trigger reviews_guard_write
  before insert or update on public.reviews
  for each row execute function public.guard_review_write();

-- ---------------------------------------------------------------- messages
-- The only legitimate update is the recipient marking a message as read.
create or replace function public.guard_message_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if new.message_text is distinct from old.message_text
     or new.sender_id is distinct from old.sender_id
     or new.receiver_id is distinct from old.receiver_id
     or new.product_id is distinct from old.product_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Messages cannot be edited';
  end if;

  if new.is_read is distinct from old.is_read and auth.uid() <> old.receiver_id then
    raise exception 'Only the recipient can mark a message as read';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_message_update() from public;

drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update
  before update on public.messages
  for each row execute function public.guard_message_update();

-- ----------------------------------------------------------------- storage
-- Uploads must go into the uploader's own folder (<user id>/...), which is how
-- the app already names them. Previously any signed-in user could write anywhere.
drop policy if exists product_images_authenticated_write on storage.objects;
create policy product_images_authenticated_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ------------------------------------------------------- admin listing search
-- The admin search box says "title or seller" but only matched the title.
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
  where (search is null
         or p.title ilike '%' || search || '%'
         or u.full_name ilike '%' || search || '%')
    and (approval_filter is null or p.approval_status = approval_filter)
  order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_search_products(text, text) from public, anon;
grant execute on function public.admin_search_products(text, text) to authenticated;
