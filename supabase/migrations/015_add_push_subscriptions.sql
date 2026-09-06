-- Push subscriptions for real browser/OS push notifications (Web Push API).
-- One row per subscribed device/browser per user; a user can have multiple
-- (phone + laptop). Deleted when the browser reports the subscription as
-- gone (410/404) or the user disables notifications.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- A signed-in user can manage only their own subscription rows (subscribe /
-- unsubscribe from their own device via the authenticated client).
create policy "Users can insert their own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own push subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create policy "Users can view their own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

-- The cron job that actually SENDS notifications reads across all users'
-- subscriptions, which requires the service-role key (see
-- src/lib/supabase/service.ts) and therefore bypasses RLS entirely, as
-- intended for a trusted server-only job. It is not covered by the
-- policies above.
