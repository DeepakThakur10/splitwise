# Shared Expenses Manager

A full-stack shared expense management application inspired by Splitwise, built for handling real-world messy financial data.

## Features

### Authentication

* User Registration
* User Login
* JWT Authentication
* Protected Routes

### Groups

* Create Groups
* Add Members
* Membership History Tracking
* Member Join and Leave Dates

### Expenses

* Equal Splits
* Unequal Splits
* Percentage Splits
* Share-Based Splits
* Multi-Currency Support (INR/USD)
* Historical Membership Validation

### Balances

* Group Balance Summary
* Individual Net Balances
* Minimum Cash Flow Settlement Suggestions

### Settlements

* Record Debt Payments
* Settlement History

### CSV Import System

* Two-Phase Import
* Import Preview
* Anomaly Detection
* User Approval Workflow
* Import Logging

---

## Tech Stack

### Frontend

* React
* Vite
* React Router
* Axios
* Tailwind CSS

### Backend

* Node.js
* Express.js

### Database

* PostgreSQL (Neon)

### Authentication

* JWT

---

## Installation

### Backend

Clone repository:

```bash
git clone <repository-url>
cd backend
```

Install dependencies:

```bash
npm install
```

Create .env file:

```env
PORT=4000

DATABASE_URL=<your_postgresql_connection_string>

JWT_SECRET=<your_secret>
```

Initialize database:

```bash
node src/db/init.js
```

Start server:

```bash
npm start
```

---

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Database

PostgreSQL relational database is used.

Main tables:

* users
* groups
* group_members
* expenses
* expense_splits
* settlements
* import_logs
* name_aliases

---

## AI Tools Used

* ChatGPT (Primary Development Assistant)
* Claude (Frontend Generation)
* GitHub Copilot (Code Completion)

---

## Deployment

Frontend:

* Vercel

Backend:

* Render

Database:

* Neon PostgreSQL
