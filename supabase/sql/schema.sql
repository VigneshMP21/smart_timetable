-- ============================================================================
-- Smart Timetable - Supabase Database Schema (Authentication Phase)
-- ============================================================================
-- Purpose: Creates the single custom table used by the authentication system,
--          enables Row Level Security, and auto-creates a profile whenever a
--          new user signs up through Supabase Auth.
--
-- Run this script in: Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- NOTE: No timetable, faculty, class, subject, scheduling, or statistics
--       tables are created here. Those modules will be added in later phases.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) PROFILES TABLE
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  email         text,
  college_name  text,
  department    text,
  role          text default 'user',
  phone_number  text,
  profile_image text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_login    timestamptz
);

-- Speed up lookups by auth user id.
create index if not exists profiles_id_idx on public.profiles (id);
create index if not exists profiles_email_idx on public.profiles (email);

-- ---------------------------------------------------------------------------
-- 2) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Users can read their own profile only.
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  using ((select auth.uid()) = id);

-- Users can update their own profile only.
-- The "with check" clause prevents a user from changing their own role:
-- the new role must equal the currently stored role. Role changes are done
-- manually by an administrator in the SQL Editor (postgres bypasses RLS).
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and (role = (select role from public.profiles where id = (select auth.uid())))
  );

-- Users can insert their own profile (used if the trigger is disabled).
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check ((select auth.uid()) = id);

-- Users can delete their own profile.
drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
  on public.profiles
  for delete
  using ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- 3) AUTO-CREATE PROFILE ON SIGN UP
-- ---------------------------------------------------------------------------
-- The service creates the profile row server-side when a new user registers.
-- The function is SECURITY DEFINER so it bypasses RLS for the insert only.
-- Role is intentionally NOT taken from sign-up metadata: every new account
-- receives the table default ("user") so clients can never set their own role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    college_name,
    department,
    phone_number,
    profile_image
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'college_name',
    new.raw_user_meta_data ->> 'department',
    new.raw_user_meta_data ->> 'phone_number',
    new.raw_user_meta_data ->> 'profile_image'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4) AUTO-UPDATE updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_updated_at();

-- ============================================================================
-- End of Authentication Phase schema.
-- ============================================================================
