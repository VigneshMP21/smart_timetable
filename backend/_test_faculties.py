"""End-to-end test for the Add Faculty module using a real Supabase JWT."""
import asyncio
import datetime
import time
import uuid

import httpx
import jwt

from app.main import app
from app.config import settings

PROFILE_UUID = "c8b82bef-b89b-4e98-ba1c-3a68a529e945"


def make_token() -> str:
    now = int(time.time())
    payload = {
        "aud": "authenticated",
        "exp": now + 3600,
        "iat": now - 10,
        "sub": PROFILE_UUID,
        "email": "test@smarttimetable.in",
        "role": "authenticated",
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


def headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def main():
    token = make_token()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # --- get a real subject for testing ---
        r = await client.get("/subjects", params={"per_page": 5}, headers=headers(token))
        r.raise_for_status()
        subjects = r.json()["records"]
        print(f"subjects available: {len(subjects)}")
        subject = subjects[0]
        subject_id = subject["id"]
        subject_name = subject["subject_name"]
        print(f"using subject: {subject['subject_code']} | {subject_name} | {subject['branch_classes']}")

        # --- create via subject_id (manual path) ---
        r = await client.post("/faculties/create", headers=headers(token), json={
            "faculty_name": "Dr. Ramesh",
            "subject_id": subject_id,
            "subject_name": subject_name,
            "branch_classes": ["CSE", "ECE"],
        })
        print("create(manual):", r.status_code, r.json())
        r.raise_for_status()

        # --- duplicate should be skipped ---
        r = await client.post("/faculties/create", headers=headers(token), json={
            "faculty_name": "Dr. Ramesh",
            "subject_id": subject_id,
            "subject_name": subject_name,
            "branch_classes": ["EEE"],
        })
        body = r.json()
        print("create(duplicate):", r.status_code, "inserted:", len(body.get("inserted", [])), "errors:", body.get("errors"))

        # --- create via subject_name (Excel-style path) ---
        r = await client.post("/faculties/create", headers=headers(token), json={
            "faculty_name": "Ms. Priya",
            "subject_name": subject_name,
            "branch_classes": ["CSE", "ECE", "EEE"],
        })
        print("create(by-name):", r.status_code, r.json().get("message"))
        r.raise_for_status()

        # --- invalid branch code must be rejected ---
        r = await client.post("/faculties/create", headers=headers(token), json={
            "faculty_name": "Mr. Karthik",
            "subject_id": subject_id,
            "subject_name": subject_name,
            "branch_classes": ["CSE", "NOPE"],
        })
        body = r.json()
        print("create(invalid-branch):", r.status_code, "errors:", body.get("errors"))

        # --- upload an Excel file (mixed valid/invalid rows) ---
        import io
        import pandas as pd

        df = pd.DataFrame({
            "Faculty Name": ["Dr. Ramesh", "Mr. Karthik", "Ms. Anjali", "Mr. Bad", ""],
            "Subject Name": [subject_name, subject_name, subject_name, "Not a Subject", " "],
            "Classes / Branch": ["CSE", "MECH,CIVIL", "AIML", "CSE", "CSE"],
        })
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, index=False)
        buf.seek(0)

        files = {"file": ("faculty_test.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = await client.post("/faculties/upload", headers=headers(token), files=files)
        up = r.json()
        print("upload:", r.status_code, up.get("message"), "error_count:", up.get("error_count"))
        for rec in up.get("records", []):
            print("   ->", rec["faculty_name"], "|", rec["subject_name"], "|", rec["branch_classes"], "|", rec.get("subject_id"), "|", rec["errors"])

        # --- batch save the valid preview rows ---
        valid = [rec for rec in up["records"] if not rec["errors"]]
        if valid:
            r = await client.post("/faculties/create", headers=headers(token), json={"records": valid})
            batch = r.json()
            print("batch save:", r.status_code, batch.get("message"))

        # --- list with search ---
        r = await client.get("/faculties", params={"per_page": 10, "sort_by": "faculty_name", "order": "asc"}, headers=headers(token))
        listing = r.json()
        print("list:", r.status_code, "total:", listing.get("total"))
        for rec in listing.get("records", []):
            print("   ->", rec["faculty_name"], "|", rec["subject_code"], rec["subject_name"], "|", rec["branch_classes"], "|", rec["id"])

        # --- search by faculty name ---
        r = await client.get("/faculties", params={"search": "ramesh"}, headers=headers(token))
        print("search 'ramesh':", [rec["faculty_name"] for rec in r.json()["records"]])

        # --- search by subject (via join) ---
        r = await client.get("/faculties", params={"search": subject_name[:12]}, headers=headers(token))
        print("search by subject:", [rec["faculty_name"] for rec in r.json()["records"]])

        # --- search by class code ---
        r = await client.get("/faculties", params={"search": "CSE"}, headers=headers(token))
        print("search 'CSE':", [rec["faculty_name"] for rec in r.json()["records"]])

        # --- update an assignment ---
        target = listing["records"][0]
        r = await client.put(f"/faculties/{target['id']}", headers=headers(token), json={
            "faculty_name": "Dr. Ramesh Kumar",
            "branch_classes": ["CSE", "ECE", "EEE"],
        })
        updated = r.json()
        print("update:", r.status_code, updated.get("faculty_name"), updated.get("branch_classes"))
        r.raise_for_status()

        # --- delete all test records (cleanup) ---
        r = await client.get("/faculties", params={"per_page": 100}, headers=headers(token))
        for rec in r.json()["records"]:
            d = await client.delete(f"/faculties/{rec['id']}", headers=headers(token))
            print("delete:", d.status_code, d.json().get("message"))

        # --- confirm empty ---
        r = await client.get("/faculties", params={"per_page": 10}, headers=headers(token))
        print("final total:", r.json()["total"])


asyncio.run(main())
