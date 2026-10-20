-- Supabase auto-grants EXECUTE to anon/authenticated right after a function is
-- created (via a default-privileges event trigger), which races an inline revoke
-- placed in the same migration as the CREATE. This migration runs afterward, once
-- that auto-grant has already landed, so the revokes below actually stick.

revoke execute on function public.get_conversations() from public, anon;
revoke execute on function public.get_favorites() from public, anon;

revoke execute on function public.admin_dashboard() from public, anon;
revoke execute on function public.admin_search_products(text, text) from public, anon;
revoke execute on function public.admin_set_product_approval(bigint, text, text) from public, anon;
revoke execute on function public.admin_set_product_featured(bigint, boolean) from public, anon;
revoke execute on function public.admin_set_user_status(uuid, text) from public, anon;
revoke execute on function public.admin_warn_user(uuid, text) from public, anon;
revoke execute on function public.admin_add_note(uuid, text) from public, anon;
revoke execute on function public.admin_list_reports(text) from public, anon;
revoke execute on function public.admin_resolve_report(bigint, text, text) from public, anon;
revoke execute on function public.admin_delete_review(bigint, text) from public, anon;

-- increment_product_view intentionally keeps anon access (anonymous browsing still counts views)
revoke execute on function public.increment_product_view(bigint) from public;
grant execute on function public.increment_product_view(bigint) to anon, authenticated;

-- re-affirm authenticated access on everything above except increment_product_view
grant execute on function public.get_conversations() to authenticated;
grant execute on function public.get_favorites() to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_search_products(text, text) to authenticated;
grant execute on function public.admin_set_product_approval(bigint, text, text) to authenticated;
grant execute on function public.admin_set_product_featured(bigint, boolean) to authenticated;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;
grant execute on function public.admin_warn_user(uuid, text) to authenticated;
grant execute on function public.admin_add_note(uuid, text) to authenticated;
grant execute on function public.admin_list_reports(text) to authenticated;
grant execute on function public.admin_resolve_report(bigint, text, text) to authenticated;
grant execute on function public.admin_delete_review(bigint, text) to authenticated;
