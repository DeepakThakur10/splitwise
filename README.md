# Splitwise

A shared expenses app for a flatmate group with changing membership, multiple split types, settlements, and a two-phase CSV importer for messy historical spreadsheet data.

## Features

- User registration and login with JWT authentication.
- Create groups and manage membership over time with join and leave dates.
- Create expenses with `equal`, `unequal`, `percentage`, and `share` split types.
- Convert foreign currency expenses to INR using the stored FX rate on each expense.
- View group balances and suggested minimum settlement payments.
- Record direct settlements between members.
- Import `Expenses Export.csv` through a preview-and-confirm workflow.
- Surface CSV anomalies before import, with row-level findings and statuses.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express
- Database: PostgreSQL only
- CSV parsing: `csv-parse`
- Auth: JWT and bcrypt password hashes

## Repository Structure

```text
backend/
  src/
    db/
      schema.sql
      init.js
      pool.js
    routes/
      auth.js
      balances.js
      expenses.js
      groups.js
      import.js
      settlements.js
      users.js
    services/
      csvParser.js
      splits.js
frontend/
  src/
    pages/
    components/
    context/
    api/
```

## Setup

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
JWT_SECRET=replace_with_a_long_random_secret
PORT=4000
FRONTEND_URL=http://localhost:5173
```

Initialize the database schema:

```bash
npm run db:init
```

Start the backend:

```bash
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` by default.

## CSV Import Flow

1. Create/register users for the people in the CSV.
2. Create a group.
3. Add members with correct join/leave dates:
   - Aisha, Rohan, Priya: active from February.
   - Meera: active through the end of March.
   - Dev: active for the trip window.
   - Sam: active from mid-April.
4. Open the group.
5. Use the `Import CSV` tab.
6. Upload the original `Expenses Export.csv` without editing it.
7. Review the anomaly list and row statuses.
8. Confirm import only after deciding which flagged rows should be imported or skipped.

## Important Commands

```bash
# backend syntax/schema
cd backend
npm run db:init
npm run dev

# frontend
cd frontend
npm run build
npm run dev
```

## Deployment

The app is designed for a split deployment:

- Backend: Render/Railway/Fly/any Node host with `DATABASE_URL`, `JWT_SECRET`, and `FRONTEND_URL`.
- Frontend: Vercel/Netlify/static host with `VITE_API_URL` pointing to the backend API if needed.
- Database: Neon PostgreSQL.

Public deployed URL: add the final deployed frontend URL here after deployment.

## AI Used

AI assistant used: OpenAI Codex / ChatGPT as a development collaborator for implementation review, UI polish, importer auditing, and documentation drafting.

See `AI_USAGE.md` for details.

