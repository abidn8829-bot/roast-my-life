-- Add continuity_memory column to roasts table
alter table public.roasts add column if not exists continuity_memory jsonb;

-- Add index for faster lookups
create index if not exists roasts_user_id_created_at_idx on public.roasts (user_id, created_at desc);
