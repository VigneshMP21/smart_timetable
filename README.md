# Smart Timetable - Automatic Timetable Scheduler

An intelligent, automated timetable generator designed for academic institutions to generate conflict-free schedules for faculty, batches, rooms, and courses.

## Tech Stack

- **Frontend**: React (Vite), TailwindCSS / Modern Vanilla CSS, Lucide / React Icons, Framer Motion, Axios
- **Backend**: Python FastAPI, Uvicorn, SQLAlchemy, AsyncPG, ReportLab, Python-Docx, Pandas
- **Database & Auth**: Supabase / PostgreSQL

---

## Getting Started

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python run.py
```
*API will run at `http://127.0.0.1:8000` (Docs at `http://127.0.0.1:8000/docs`)*

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
*Frontend will run at `http://localhost:5173`*

---

## Features

- **Automated Timetable Generation**: Conflict-free scheduling considering faculty workload, room capacity, and course requirements.
- **Faculty & Batch Management**: Easy management of faculty members, student batches, and subjects.
- **Export & Reports**: Export schedules to PDF and Word documents.
- **Modern Responsive Dashboard**: Interactive UI with real-time statistics and preview.
