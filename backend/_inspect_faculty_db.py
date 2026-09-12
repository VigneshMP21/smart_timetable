import asyncio
from sqlalchemy import text
from app.database import engine


async def main():
    async with engine.connect() as conn:
        print("== public tables ==")
        rows = (await conn.execute(text(
            "select table_name from information_schema.tables where table_schema='public' order by table_name"
        ))).fetchall()
        print([r[0] for r in rows])

        print("\n== faculties columns ==")
        rows = (await conn.execute(text(
            "select column_name, data_type, is_nullable, column_default from information_schema.columns "
            "where table_schema='public' and table_name='faculties' order by ordinal_position"
        ))).fetchall()
        for r in rows:
            print(r)

        print("\n== faculties policies ==")
        rows = (await conn.execute(text(
            "select policyname from pg_policies where schemaname='public' and tablename='faculties'"
        ))).fetchall()
        print([r[0] for r in rows])

        print("\n== faculties rows ==")
        rows = (await conn.execute(text("select count(*) from public.faculties"))).fetchall()
        print(rows)

        print("\n== timetable_entries columns ==")
        rows = (await conn.execute(text(
            "select column_name, data_type, is_nullable, column_default from information_schema.columns "
            "where table_schema='public' and table_name='timetable_entries' order by ordinal_position"
        ))).fetchall()
        for r in rows:
            print(r)

        print("\n== timetable_entries FKs ==")
        rows = (await conn.execute(text(
            "select tc.constraint_name, kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_col "
            "from information_schema.table_constraints tc "
            "join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name "
            "join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name "
            "where tc.constraint_type='FOREIGN KEY' and tc.table_name='timetable_entries'"
        ))).fetchall()
        for r in rows:
            print(r)

        print("\n== timetable_entries rows ==")
        rows = (await conn.execute(text("select count(*) from public.timetable_entries"))).fetchall()
        print(rows)

        print("\n== subjects columns ==")
        rows = (await conn.execute(text(
            "select column_name, data_type from information_schema.columns "
            "where table_schema='public' and table_name='subjects' order by ordinal_position"
        ))).fetchall()
        for r in rows:
            print(r)

        print("\n== profiles ==")
        cols = (await conn.execute(text(
            "select column_name from information_schema.columns "
            "where table_schema='public' and table_name='profiles' order by ordinal_position"
        ))).fetchall()
        print([c[0] for c in cols])
        rows = (await conn.execute(text(
            "select id, full_name from public.profiles order by created_at"
        ))).fetchall()
        for r in rows:
            print(r)

        print("\n== constraints columns ==")
        rows = (await conn.execute(text(
            "select column_name, data_type from information_schema.columns "
            "where table_schema='public' and table_name='constraints' order by ordinal_position"
        ))).fetchall()
        for r in rows:
            print(r)

        print("\n== subjects count ==")
        rows = (await conn.execute(text("select count(*) from public.subjects"))).fetchall()
        print(rows)

        print("\n== classes short codes ==")
        rows = (await conn.execute(text(
            "select short_code, section from public.classes order by short_code"
        ))).fetchall()
        print([(r[0], r[1]) for r in rows])


asyncio.run(main())
