import asyncio
from sqlalchemy import text
from app.database import engine


async def main():
    async with engine.connect() as conn:
        rows = (await conn.execute(text(
            "select column_name, data_type from information_schema.columns "
            "where table_schema='public' and table_name='faculties' order by ordinal_position"
        ))).fetchall()
        print("faculties columns:", rows)

        rows = (await conn.execute(text(
            "select indexname, indexdef from pg_indexes where schemaname='public' and tablename='faculties' order by indexname"
        ))).fetchall()
        for r in rows:
            print(r)


asyncio.run(main())
