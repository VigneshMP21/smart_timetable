-- =====================================================================
-- Automatic Timetable Scheduler - Supabase schema (single file)
-- File    : database/schema/supabase.sql
-- Purpose : Provision the complete schema for the Supabase PostgreSQL
--           database: profiles (linked to auth.users), application tables,
--           Row Level Security policies and the signup trigger.
--
-- Usage   : Run this file once in the Supabase dashboard (SQL Editor) after
--           creating the project. It is idempotent (IF NOT EXISTS).
--
-- Access  : All application data flows through the FastAPI backend, which
--           connects with the service-role database URL and therefore
--           bypasses RLS. RLS policies below are defense-in-depth so the
--           frontend's anon key can never read or mutate other users' data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles (one row per Supabase auth user, PK = auth.users.id)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
    id            uuid primary key references auth.users (id) on delete cascade,
    full_name     text not null default '',
    college_name  text default '',
    department    text default '',
    phone_number  text default '',
    profile_image text default '',
    role          text not null default 'user',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- Auto-create a profile row whenever a new Supabase user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, college_name, department, phone_number)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', ''),
        coalesce(new.raw_user_meta_data ->> 'college_name', ''),
        coalesce(new.raw_user_meta_data ->> 'department', ''),
        coalesce(new.raw_user_meta_data ->> 'phone_number', '')
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
    on public.profiles
    for select
    to authenticated
    using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
    on public.profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- 2. classes (owned by the creating user)
-- ---------------------------------------------------------------------
create table if not exists public.classes (
    id         bigserial primary key,
    class_name text not null,
    short_code text not null,
    section    text not null,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.classes
    add constraint uq_classes_class_name_section unique (class_name, section);

alter table public.classes
    add constraint uq_classes_short_code_section unique (short_code, section);

create index if not exists idx_classes_class_name on public.classes (class_name);
create index if not exists idx_classes_short_code on public.classes (short_code);
create index if not exists idx_classes_section on public.classes (section);
create index if not exists idx_classes_created_by on public.classes (created_by);

alter table public.classes enable row level security;

drop policy if exists "classes_select_authenticated" on public.classes;
create policy "classes_select_authenticated"
    on public.classes
    for select
    to authenticated
    using (true);

drop policy if exists "classes_insert_owner" on public.classes;
create policy "classes_insert_owner"
    on public.classes
    for insert
    to authenticated
    with check (auth.uid() = created_by);

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

-- ---------------------------------------------------------------------
-- 2b. rooms (owned by the creating user)
-- Room No is the only required field. class_short_code and section are
-- display columns loaded from the Excel file. class_id optionally assigns a
-- class to the room. The unique constraint means a class can be assigned to
-- at most one room.
-- ---------------------------------------------------------------------
create table if not exists public.rooms (
    id               bigserial primary key,
    room_no          text not null,
    class_short_code text,
    section          text,
    class_id         bigint references public.classes (id) on delete set null,
    created_by       uuid references public.profiles (id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

alter table public.rooms
    add constraint uq_rooms_room_no unique (room_no);

alter table public.rooms
    add constraint uq_rooms_class_id unique (class_id);

create index if not exists idx_rooms_room_no on public.rooms (room_no);
create index if not exists idx_rooms_class_short_code on public.rooms (class_short_code);
create index if not exists idx_rooms_section on public.rooms (section);
create index if not exists idx_rooms_class_id on public.rooms (class_id);
create index if not exists idx_rooms_created_by on public.rooms (created_by);

alter table public.rooms enable row level security;

drop policy if exists "rooms_select_authenticated" on public.rooms;
create policy "rooms_select_authenticated"
    on public.rooms
    for select
    to authenticated
    using (true);

drop policy if exists "rooms_insert_owner" on public.rooms;
create policy "rooms_insert_owner"
    on public.rooms
    for insert
    to authenticated
    with check (auth.uid() = created_by);

drop policy if exists "rooms_update_owner" on public.rooms;
create policy "rooms_update_owner"
    on public.rooms
    for update
    to authenticated
    using (auth.uid() = created_by)
    with check (auth.uid() = created_by);

drop policy if exists "rooms_delete_owner" on public.rooms;
create policy "rooms_delete_owner"
    on public.rooms
    for delete
    to authenticated
    using (auth.uid() = created_by);

-- ---------------------------------------------------------------------
-- 3. faculties
-- ---------------------------------------------------------------------
create table if not exists public.faculties (
    id         bigserial primary key,
    name       text not null unique,
    department text not null,
    available  text not null default 'All',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_faculties_name on public.faculties (name);

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

-- ---------------------------------------------------------------------
-- 4. subjects (linked to a class and a faculty member)
-- ---------------------------------------------------------------------
create table if not exists public.subjects (
    id             bigserial primary key,
    class_id       bigint not null references public.classes (id) on delete cascade,
    name           text not null,
    faculty_id     bigint not null references public.faculties (id) on delete cascade,
    hours_per_week integer not null,
    subject_type   text not null,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_subjects_class_id on public.subjects (class_id);
create index if not exists idx_subjects_faculty_id on public.subjects (faculty_id);

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

-- ---------------------------------------------------------------------
-- 5. constraints (global scheduler configuration)
-- ---------------------------------------------------------------------
create table if not exists public.constraints (
    id                     bigserial primary key,
    working_days           text not null default 'Monday,Tuesday,Wednesday,Thursday,Friday',
    periods_per_day        integer not null default 7,
    lunch_break            integer not null default 4,
    break_period           integer not null default 2,
    max_consecutive_classes integer not null default 3,
    max_daily_hours        integer not null default 6,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);

alter table public.constraints enable row level security;

drop policy if exists "constraints_select_authenticated" on public.constraints;
create policy "constraints_select_authenticated"
    on public.constraints
    for select
    to authenticated
    using (true);

drop policy if exists "constraints_update_authenticated" on public.constraints;
create policy "constraints_update_authenticated"
    on public.constraints
    for update
    to authenticated
    using (true)
    with check (true);

-- ---------------------------------------------------------------------
-- 6. timetable_entries (generated schedule slots)
-- ---------------------------------------------------------------------
create table if not exists public.timetable_entries (
    id         bigserial primary key,
    class_id   bigint not null references public.classes (id) on delete cascade,
    subject_id bigint not null references public.subjects (id) on delete cascade,
    faculty_id bigint not null references public.faculties (id) on delete cascade,
    day        text not null,
    period     integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_timetable_entries_class_id on public.timetable_entries (class_id);
create index if not exists idx_timetable_entries_faculty_id on public.timetable_entries (faculty_id);
create index if not exists idx_timetable_entries_subject_id on public.timetable_entries (subject_id);

alter table public.timetable_entries enable row level security;

drop policy if exists "timetable_entries_select_authenticated" on public.timetable_entries;
create policy "timetable_entries_select_authenticated"
    on public.timetable_entries
    for select
    to authenticated
    using (true);

drop policy if exists "timetable_entries_insert_authenticated" on public.timetable_entries;
create policy "timetable_entries_insert_authenticated"
    on public.timetable_entries
    for insert
    to authenticated
    with check (true);

drop policy if exists "timetable_entries_update_authenticated" on public.timetable_entries;
create policy "timetable_entries_update_authenticated"
    on public.timetable_entries
    for update
    to authenticated
    using (true)
    with check (true);

drop policy if exists "timetable_entries_delete_authenticated" on public.timetable_entries;
create policy "timetable_entries_delete_authenticated"
    on public.timetable_entries
    for delete
    to authenticated
    using (true);
