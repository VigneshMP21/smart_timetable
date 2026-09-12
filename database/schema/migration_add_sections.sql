-- ============================================================
-- Migration: Room + Faculty Section support
--
-- Adds display columns for the Smart Timetable feature:
--   rooms.class_short_code  - class short code from the Excel file
--   rooms.section           - section the room belongs to
--   faculties.section       - class section the faculty teaches
--
-- Idempotent: each statement is guarded so it can be re-run safely.
-- ============================================================

-- rooms.class_short_code
alter table public.rooms
    add column if not exists class_short_code text;

-- rooms.section
alter table public.rooms
    add column if not exists section text;

-- faculties.section
alter table public.faculties
    add column if not exists section text;

-- Indexes for instant search / sorting
create index if not exists idx_rooms_class_short_code on public.rooms (class_short_code);
create index if not exists idx_rooms_section on public.rooms (section);
create index if not exists idx_faculties_section on public.faculties (section);

-- Backfill existing rows so the new columns are not blank.
update public.rooms r
   set section = 'A'
 where r.section is null;

update public.rooms r
   set class_short_code = c.short_code
  from public.classes c
 where r.class_id = c.id
   and r.class_short_code is null;
