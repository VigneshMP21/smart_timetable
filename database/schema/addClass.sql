-- =====================================================================
-- Module  : Add Class
-- File    : database/schema/addClass.sql
-- Purpose : Superseded. The canonical, current schema for academic
--           classes/branches is database/schema/supabase.sql (classes with
--           created_by UUID -> profiles.id and RLS policies).
--
-- NOTE    : This older definition is kept for reference only and MUST NOT
--           be run against the Supabase database (uuid id layout differs
--           from the SQLAlchemy bigserial model).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Classes table (class/branch + short code + section)
-- ---------------------------------------------------------------------
create table if not exists public.classes (
    id         uuid primary key default gen_random_uuid(),
    class_name text not null,
    short_code text not null,
    section    text not null,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Constraints
-- A class is uniquely identified by its full name together with its
-- section, and by its short code together with its section.
-- ---------------------------------------------------------------------
alter table public.classes
    add constraint uq_classes_class_name_section unique (class_name, section);

alter table public.classes
    add constraint uq_classes_short_code_section unique (short_code, section);

-- ---------------------------------------------------------------------
-- Indexes (instant search by class name, short code, section)
-- ---------------------------------------------------------------------
create index if not exists idx_classes_class_name on public.classes (class_name);
create index if not exists idx_classes_short_code on public.classes (short_code);
create index if not exists idx_classes_section on public.classes (section);
create index if not exists idx_classes_created_by on public.classes (created_by);
create index if not exists idx_classes_created_at on public.classes (created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security
-- Authenticated users can insert and read classes. Update/delete
-- policies are intentionally staged for the future CRUD release.
-- Unauthenticated users cannot access the table at all.
-- ---------------------------------------------------------------------
alter table public.classes enable row level security;

drop policy if exists "classes_select_authenticated" on public.classes;
create policy "classes_select_authenticated"
    on public.classes
    for select
    to authenticated
    using (true);

drop policy if exists "classes_insert_authenticated" on public.classes;
create policy "classes_insert_authenticated"
    on public.classes
    for insert
    to authenticated
    with check (auth.uid() = created_by);

-- Staged for the future Edit/Delete module:
drop policy if exists "classes_update_owner" on public.classes;
create policy "classes_update_owner"
    on public.classes
    for update
    to authenticated
    using (auth.uid() = created_by)
    with check (auth.uid() = created_by);

drop policy if exists "classes_delete_owner" on public.classes;
create policy "classes_delete_owner"
    on public.classes
    for delete
    to authenticated
    using (auth.uid() = created_by);
