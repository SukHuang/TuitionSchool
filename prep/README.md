# Environment Readiness Spikes

This folder contains the small readiness checks required by the assignment:

1. Neon SQL editor check: run [db/schema.sql](../db/schema.sql) and insert/select one row manually.
2. DB connection from code: run `node prep/db-test.js`.
3. Render hello world: use [api/src/index.js](../api/src/index.js) endpoint `GET /api/health`.
4. API to DB check: use endpoint `GET /api/db-check`.
5. Frontend to API check: deploy [prep/pages-api-check.html](./pages-api-check.html) on GitHub Pages and verify no CORS error.
6. Secrets check: keep `.env` local only and verify with `git grep postgres://`.
