-- ============================================================
-- Add Faculty module schema
-- Faculty: a faculty member assigned to exactly ONE subject and
-- ONE OR MORE branches (classes short codes), e.g.
-- {CSE, ECE, AIML}.
--
-- A faculty member can appear in multiple rows only when teaching
-- different subjects; the unique index on (lower(faculty_name),
-- subject_id) guarantees a faculty is never assigned the same
-- subject twice (including across Excel re-uploads).
--
-- Note: this file supersedes the legacy faculties table found in
-- database/schema/supabase.sql (id bigserial, name, department,
-- available). It is kept standalone on purpose, mirroring the
-- Add Subjects module (addSubject.sql).
-- ============================================================

create table if not exists public.faculties (
    id             uuid primary key default gen_random_uuid(),
    faculty_name   text not null,
    subject_id     uuid not null references public.subjects (id) on delete cascade,
    section        text,
    branch_classes text[] not null default '{}'::text[],
    created_by     uuid references public.profiles (id) on delete set null,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_faculties_faculty_name on public.faculties (faculty_name);
create index if not exists idx_faculties_subject_id on public.faculties (subject_id);
create index if not exists idx_faculties_section on public.faculties (section);
create index if not exists idx_faculties_created_by on public.faculties (created_by);

-- A faculty member must never be assigned the same subject twice.
create unique index if not exists uq_faculties_name_subject
    on public.faculties (lower(faculty_name), subject_id);

alter table public.faculties enable row level security;

drop policy if exists "faculties_select_authenticated" on public.faculties;
create policy "faculties_select_authenticated"
    on public.faculties
    for select
    to authenticated
    using (true);

drop policy if exists "faculties_insert_authenticated" on public.faculties;
create policy "faculties_insert_authenticated"
    on public.faculties
    for insert
    to authenticated
    with check (true);

drop policy if exists "faculties_update_authenticated" on public.faculties;
create policy "faculties_update_authenticated"
    on public.faculties
    for update
    to authenticated
    using (true)
    with check (true);

drop policy if exists "faculties_delete_authenticated" on public.faculties;
create policy "faculties_delete_authenticated"
    on public.faculties
    for delete
    to authenticated
    using (true);
