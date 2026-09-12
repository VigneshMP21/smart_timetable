-- ============================================================
-- Add Subjects module schema
-- Subject: an academic subject assigned to one or more branches
-- (classes short codes), e.g. {CSE, ECE, AIML}.
--
-- Note: this file supersedes the old subjects table found in
-- database/schema/supabase.sql (which linked a subject to a
-- single class + faculty). It is kept standalone on purpose.
-- ============================================================

create table if not exists public.subjects (
    id             uuid primary key default gen_random_uuid(),
    subject_code   text not null unique,
    subject_name   text not null,
    branch_classes text[] not null default '{}'::text[],
    created_by     uuid references public.profiles (id) on delete set null,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_subjects_subject_code on public.subjects (subject_code);
create index if not exists idx_subjects_subject_name on public.subjects (subject_name);
create index if not exists idx_subjects_created_by on public.subjects (created_by);

alter table public.subjects enable row level security;

drop policy if exists "subjects_select_authenticated" on public.subjects;
create policy "subjects_select_authenticated"
    on public.subjects
    for select
    to authenticated
    using (true);

drop policy if exists "subjects_insert_authenticated" on public.subjects;
create policy "subjects_insert_authenticated"
    on public.subjects
    for insert
    to authenticated
    with check (true);

drop policy if exists "subjects_update_authenticated" on public.subjects;
create policy "subjects_update_authenticated"
    on public.subjects
    for update
    to authenticated
    using (true)
    with check (true);

drop policy if exists "subjects_delete_authenticated" on public.subjects;
create policy "subjects_delete_authenticated"
    on public.subjects
    for delete
    to authenticated
    using (true);
