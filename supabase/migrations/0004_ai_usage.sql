-- Daily AI usage cap per user (Algeria day), so one account can't run up the API bill.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
-- no policies: only the function below touches it

-- Consumes one AI credit for the signed-in user; raises AI_LIMIT (P0429) past the cap.
create or replace function public.use_ai_credit(p_limit integer default 40)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Africa/Algiers')::date;
  n integer;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  insert into public.ai_usage (user_id, day, count) values (uid, today, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into n;
  if n > p_limit then raise exception 'AI_LIMIT' using errcode = 'P0429'; end if;
  return p_limit - n;
end $$;

revoke all on function public.use_ai_credit(integer) from public, anon;
grant execute on function public.use_ai_credit(integer) to authenticated;
