# Sunrise Tuition Centre - Class / Teacher / Student Manager

Cloud-hosted tuition school management app with mobile-friendly UI, REST API, and PostgreSQL persistence.

## 1. Team

| Name | Role | GitHub |
|---|---|---|
| Your Name | Frontend / API / DB | @your-handle |

## 2. Live links (required)

| Component | Platform | URL | Status |
|---|---|---|---|
| Frontend | GitHub Pages | https://your-user.github.io/tuition-school-vibe-coding-exercise-main/ | Update before submission |
| API | Render | https://your-render-service.onrender.com/api/health | Update before submission |
| Database | Neon (PostgreSQL) | Project name: your-neon-project | Update before submission |

Render free tier can sleep when idle. The frontend includes a loading message for cold start delays.

## 3. What this app does

- Manages Classes, Teachers, and Students with full create, read, update, and delete operations.
- Enforces business rules:
  - Student code suggestion follows `<class_code>-studentNN`.
  - Class deletion is blocked if students are still enrolled.
  - Teacher deletion unassigns the class.
- Shows class details with assigned teacher and students.
- Includes dashboard summary counts and search/filter tools.

## 4. Architecture

```text
[Browser / Mobile] --HTTPS--> [GitHub Pages frontend]
                               | fetch JSON
                               v
                        [Render API (Node + Express)]
                               | SQL via pg
                               v
                         [Neon PostgreSQL]
```

### Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | HTML + CSS + Vanilla JS | Simple static hosting on GitHub Pages |
| API | Node.js + Express | Fast CRUD API and easy Render deployment |
| DB | PostgreSQL (Neon) + `pg` | Managed cloud relational DB |
| Seed loader | Node + `xlsx` | Loads dummy data from the provided Excel file |

### Repository layout

```text
/frontend   # static site for GitHub Pages
/api        # REST API for Render
/db         # schema.sql
/prep       # environment readiness checks
README.md
requirements.md
tuition_school_dummy_data.xlsx
```

## 5. Features achieved

### Core
- [x] Classes: list / create / update / delete
- [x] Teachers: list / create / update / delete
- [x] Students: list / create / update / delete
- [x] Student code auto-suggested as `<class_code>-studentNN`
- [x] Deleting a class that still has students is blocked with a message
- [x] Deleting a teacher un-assigns them from their class
- [x] Class detail view shows teacher + students
- [x] Search / filter on each list (students filter by class)
- [x] Dashboard counts (classes / teachers / students)
- [x] Mobile responsive at 375 px (no horizontal page scroll)
- [x] Loading & error states
- [x] Seed data loader from `tuition_school_dummy_data.xlsx`

### Stretch
- [ ] Many-to-many teacher-to-class assignment
- [ ] Schedule / weekly calendar view
- [ ] Export students to CSV
- [ ] Dark mode
- [ ] Simple admin login

## 6. API reference

Base URL: `https://your-render-service.onrender.com`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/db-check` | DB connectivity check (`SELECT NOW()`) |
| GET | `/api/dashboard` | Summary counts |
| GET / POST | `/api/classes` | List / create classes |
| GET / PUT / DELETE | `/api/classes/:id` | Read / update / delete class |
| GET | `/api/classes/:id/next-student-code` | Student code suggestion |
| GET / POST | `/api/teachers` | List / create teachers |
| GET / PUT / DELETE | `/api/teachers/:id` | Read / update / delete teacher |
| GET / POST | `/api/students?class_id=` | List / create students |
| GET / PUT / DELETE | `/api/students/:id` | Read / update / delete student |

Validation errors return JSON in the form:

```json
{ "error": "message" }
```

## 7. Database schema

Primary schema file: `db/schema.sql`.

Tables:
- `classes`
- `teachers`
- `students`

Includes uniqueness constraints for `class_code`, `teacher_code`, and `student_code`, plus foreign keys and status checks.

## 8. Screenshots

Add screenshots before final submission:

- `docs/mobile.png` (375 px)
- `docs/desktop.png`
- `docs/class-detail.png`
- `docs/delete-confirmation.png`

## 9. Demo

Add your 3-5 minute demo link or recording path here.

## 10. Setup & deployment notes

### Environment variables (Render)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `CORS_ORIGIN` | GitHub Pages origin (for example, `https://your-user.github.io`) |
| `PORT` | API port (Render sets this automatically) |

### Backend local development

```bash
cd api
npm install
cp .env.example .env
# set DATABASE_URL and CORS_ORIGIN in .env
npm run start
```

### Database setup

Option A (Neon SQL editor):
1. Run `db/schema.sql`.
2. Run the seed script from local machine with Neon `DATABASE_URL`.

Option B (seed script does both schema + seed):
```bash
cd api
npm install
npm run seed
```

### Frontend local preview

1. Edit `frontend/config.js` and set `API_BASE` to your Render URL.
2. Serve `frontend` using any static server or open `frontend/index.html` directly.

### Deploy to GitHub Pages

1. Push repository to GitHub.
2. In repository settings, enable GitHub Pages for the `frontend` folder (or deploy via workflow).
3. Confirm the Pages URL can reach your Render API.

### Deploy API to Render

1. Create a new Web Service from this repository.
2. Root directory: `api`.
3. Build command: `npm install`.
4. Start command: `npm start`.
5. Set environment variables: `DATABASE_URL`, `CORS_ORIGIN`.

## 11. Preparation & collaboration evidence

Environment readiness artifacts are in `prep`:

- `prep/db-test.js` for DB connection check
- `prep/pages-api-check.html` for frontend-to-API check
- `prep/README.md` for the six required checks

## 12. Vibe-coding log

- Generated schema and API scaffolding from assignment requirements.
- Added business-rule enforcement in backend transactions.
- Built responsive frontend with section tabs and CRUD forms.
- Added loading/error states for API cold starts and failures.
- Added seed script to parse Excel source data.

## 13. Self-assessment checklist

| # | Criterion | Done |
|---|---|---|
| 1 | Frontend loads from `*.github.io` with no console errors | Pending live deployment |
| 2 | API reachable at `*.onrender.com`; CORS works from Pages | Pending live deployment |
| 3 | Data persists in Neon | Pending live deployment |
| 4 | Create/update/delete works for Classes, Teachers, Students | Implemented |
| 5 | Deleting a class with students is blocked | Implemented |
| 6 | Student code follows `<class_code>-studentNN` | Implemented |
| 7 | Usable at 375 px width | Implemented |
| 8 | No secrets committed | Implemented (`.env` ignored) |
| 9 | README includes architecture and setup steps | Implemented |
| 10 | Restricted trademark strings are not included in solution code | Implemented |
| 11 | Preparation spikes in `/prep` and documented | Implemented |
| 12 | Submitted by due date | Pending |

## 14. Known issues / next steps

- Replace placeholder live URLs after deployment.
- Add real screenshots and demo link.
- Run full end-to-end smoke test against live Render + Neon + GitHub Pages.
