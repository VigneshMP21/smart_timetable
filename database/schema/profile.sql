-- =====================================================================
-- Module  : Profile (User Accounts)
-- File    : database/schema/profile.sql
-- Purpose : Superseded. The canonical, current schema for user profiles is
--           database/schema/supabase.sql (profiles linked to auth.users,
--           the handle_new_user signup trigger and RLS policies).
--
-- NOTE    : This older definition is kept for reference only. It describes
--           the pre-Supabase layout (email/password_hash columns) and MUST
--           NOT be run against the Supabase database.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profiles table (one row per authenticated user account)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
    id                uuid primary key default gen_random_uuid(),
    email             text not null unique,
    password_hash     text not null,
    full_name         text not null default '',
    college_name      text,
    department        text,
    phone_number      text,
    profile_image     text,
    role              text not null default 'user',
    email_verified    boolean not null default false,
    email_verified_at timestamptz,
    last_login        timestamptz,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indexes (query hot-paths)
-- ---------------------------------------------------------------------
create index if not exists idx_profiles_email on public.profiles (email);
create index if not exists idx_profiles_role on public.profiles (role);

-- ---------------------------------------------------------------------
-- Row Level Security
-- A profile row is only visible/editable by its owner. Insert is allowed
-- for authenticated users (registration flow) and by the auth trigger
-- that mirrors the Supabase auth.users row into profiles.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
    on public.profiles
    for select
    to authenticated
    using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
    on public.profiles
    for insert
    to authenticated
    with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
    on public.profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);
