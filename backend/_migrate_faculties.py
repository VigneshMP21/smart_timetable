import asyncio

from sqlalchemy import text
from app.database import engine

ADD_FACULTY_SQL = r"C:\Users\sivak\OneDrive\Desktop\Automatic-TimeTable-Scheduler\database\schema\addFaculty.sql"


def split_statements(sql: str):
    """Split a SQL script into individual statements, respecting quotes and
    comment lines (there are no dollar-quoted bodies in addFaculty.sql)."""
    statements = []
    current = []
    i, n = 0, len(sql)
    state = "normal"  # normal, single, double, linecomment

    def flush():
        stmt = "".join(current).strip()
        if stmt:
            statements.append(stmt)
        current.clear()

    while i < n:
        c = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ""

        if state == "normal":
            if c == "'":
                state = "single"
                current.append(c)
            elif c == '"':
                state = "double"
                current.append(c)
            elif c == "-" and nxt == "-":
                state = "linecomment"
                current.append(c)
            elif c == ";":
                flush()
            else:
                current.append(c)
        elif state == "single":
            current.append(c)
            if c == "'":
                state = "normal"
        elif state == "double":
            current.append(c)
            if c == '"':
                state = "normal"
        elif state == "linecomment":
            current.append(c)
            if c == "\n":
                state = "normal"
        i += 1

    flush()
    return statements


def strip_comments(s: str) -> str:
    """Remove leading whitespace and -- comment lines from a statement."""
    lines = s.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        cleaned.append(line)
    return "\n".join(cleaned).strip()


async def main():
    with open(ADD_FACULTY_SQL, encoding="utf-8") as f:
        statements = [strip_comments(s) for s in split_statements(f.read())]
    statements = [s for s in statements if s]

    async with engine.begin() as conn:
        print("== Dropping legacy faculties table + FK ==")
        await conn.execute(text("alter table public.timetable_entries drop constraint if exists timetable_entries_faculty_id_fkey"))
        await conn.execute(text("drop table if exists public.faculties"))
        print("done")

        print("\n== Applying addFaculty.sql ==")
        for idx, stmt in enumerate(statements, 1):
            if not stmt:
                continue
            await conn.execute(text(stmt))
            print(f"  [{idx:02d}] ok: {' '.join(stmt.split())[:70]}")

        print("\n== Migrating timetable_entries.faculty_id to uuid ==")
        await conn.execute(text("alter table public.timetable_entries drop column faculty_id"))
        await conn.execute(text("alter table public.timetable_entries add column faculty_id uuid not null"))
        print("done")

        # Sanity checks
        print("\n== faculties columns ==")
        rows = (await conn.execute(text(
            "select column_name, data_type, column_default from information_schema.columns "
            "where table_schema='public' and table_name='faculties' order by ordinal_position"
        ))).fetchall()
        for r in rows:
            print(r)

        print("\n== faculties policies ==")
        rows = (await conn.execute(text(
            "select policyname from pg_policies where schemaname='public' and tablename='faculties' order by policyname"
        ))).fetchall()
        print([r[0] for r in rows])

        print("\n== faculties indexes ==")
        rows = (await conn.execute(text(
            "select indexname from pg_indexes where schemaname='public' and tablename='faculties' order by indexname"
        ))).fetchall()
        print([r[0] for r in rows])

        print("\n== timetable_entries columns ==")
        rows = (await conn.execute(text(
            "select column_name, data_type from information_schema.columns "
            "where table_schema='public' and table_name='timetable_entries' order by ordinal_position"
        ))).fetchall()
        for r in rows:
            print(r)


asyncio.run(main())
