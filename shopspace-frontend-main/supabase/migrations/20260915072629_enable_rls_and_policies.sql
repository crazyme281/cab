alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.messages enable row level security;
alter table public.transactions enable row level security;
alter table public.reviews enable row level security;
alter table public.user_warnings enable row level security;
alter table public.admin_notes enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.announcements enable row level security;
alter table public.favorites enable row level security;
alter table public.universities enable row level security;
alter table public.campuses enable row level security;
alter table public.faculties enable row level security;
alter table public.departments enable row level security;
alter table public.pickup_locations enable row level security;

-- users: profiles are readable by any signed-in user, editable only by their owner
-- (role/status changes are blocked for non-admins by the trigger), full control for admins
create policy users_select_authenticated on public.users for select to authenticated using (true);
create policy users_update_own on public.users for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy users_admin_all on public.users for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- categories: public browse, admin-managed
create policy categories_select_all on public.categories for select using (true);
create policy categories_admin_write on public.categories for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- products: approved listings are public; sellers always see + manage their own; admins see/manage all
create policy products_select_public on public.products for select using (
  approval_status = 'approved' or seller_id = (select auth.uid()) or (select public.is_admin())
);
create policy products_insert_own on public.products for insert to authenticated with check (seller_id = (select auth.uid()));
create policy products_update_own on public.products for update to authenticated using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
create policy products_delete_own on public.products for delete to authenticated using (seller_id = (select auth.uid()));
create policy products_admin_all on public.products for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- messages: only the two participants
create policy messages_select_participants on public.messages for select to authenticated using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));
create policy messages_insert_own on public.messages for insert to authenticated with check (sender_id = (select auth.uid()));
create policy messages_update_participants on public.messages for update to authenticated using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));
create policy messages_admin_all on public.messages for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- transactions: only buyer + seller
create policy transactions_select_participants on public.transactions for select to authenticated using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.is_admin()));
create policy transactions_insert_buyer on public.transactions for insert to authenticated with check (buyer_id = (select auth.uid()));
create policy transactions_update_participants on public.transactions for update to authenticated using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or (select public.is_admin()));
create policy transactions_admin_all on public.transactions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- reviews: publicly readable (helps buyers decide); only a real transaction participant can leave one
create policy reviews_select_all on public.reviews for select using (true);
create policy reviews_insert_participant on public.reviews for insert to authenticated with check (
  reviewer_id = (select auth.uid())
  and exists (
    select 1 from public.transactions t
    where t.transaction_id = reviews.transaction_id
      and (t.buyer_id = (select auth.uid()) or t.seller_id = (select auth.uid()))
  )
);
create policy reviews_update_own on public.reviews for update to authenticated using (reviewer_id = (select auth.uid())) with check (reviewer_id = (select auth.uid()));
create policy reviews_delete_own on public.reviews for delete to authenticated using (reviewer_id = (select auth.uid()));
create policy reviews_admin_all on public.reviews for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- user_warnings: the warned user can see their own; only admins create/manage, and only for their own admin_id
create policy user_warnings_select_own on public.user_warnings for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy user_warnings_admin_all on public.user_warnings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()) and admin_id = (select auth.uid()));

-- admin_notes: admin-only, never visible to the user being noted about
create policy admin_notes_admin_only on public.admin_notes for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- reports: reporter sees their own submissions; admins see/manage everything
create policy reports_select_own on public.reports for select to authenticated using (reporter_id = (select auth.uid()) or (select public.is_admin()));
create policy reports_insert_own on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy reports_admin_all on public.reports for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- audit_logs: admin-only
create policy audit_logs_admin_only on public.audit_logs for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- announcements: public read, admin write
create policy announcements_select_all on public.announcements for select using (true);
create policy announcements_admin_write on public.announcements for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- favorites: strictly the owner
create policy favorites_owner_all on public.favorites for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- directory tables (universities/campuses/faculties/departments/pickup_locations): public read, admin write
create policy universities_select_all on public.universities for select using (true);
create policy universities_admin_write on public.universities for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy campuses_select_all on public.campuses for select using (true);
create policy campuses_admin_write on public.campuses for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy faculties_select_all on public.faculties for select using (true);
create policy faculties_admin_write on public.faculties for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy departments_select_all on public.departments for select using (true);
create policy departments_admin_write on public.departments for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy pickup_locations_select_all on public.pickup_locations for select using (true);
create policy pickup_locations_admin_write on public.pickup_locations for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
