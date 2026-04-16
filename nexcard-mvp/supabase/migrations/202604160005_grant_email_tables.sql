begin;

-- Grants para email_log
grant select, insert on public.email_log to authenticated;

-- Grants para email_unsubscribe
grant insert on public.email_unsubscribe to anon;
grant select, insert on public.email_unsubscribe to authenticated;

commit;
