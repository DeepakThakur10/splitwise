# SplitWise Expense Manager

A full-stack shared expense management application built for managing group expenses, settlements, balance calculations, and CSV imports with anomaly detection.

## Features

### Authentication

* User registration
* User login
* JWT authentication

### Groups

* Create groups
* Add members
* Track membership history
* Support members joining and leaving

### Expenses

* Create expenses
* Equal split
* Unequal split
* Percentage split
* Share-based split
* Multi-currency support
* Historical membership validation

### Balances

* Group balance summary
* Individual balances
* Minimum cash-flow settlement suggestions

### Settlements

* Record payments between members
* Track settlement history

### CSV Import

* Two-phase import
* Preview before import
* Anomaly detection
* Settlement detection
* Duplicate detection support
* Import logs

## Technology Stack

Frontend

* React
* Tailwind CSS
* Axios

Backend

* Node.js
* Express.js

Database

* PostgreSQL (Neon)

Authentication

* JWT

## Setup

### Backend

Install dependencies

npm install

Create .env

PORT=4000
DATABASE_URL=your_neon_connection_string
JWT_SECRET=your_secret

Run server

npm run dev

### Frontend

Install dependencies

npm install

Create .env

VITE_API_URL=http://localhost:4000

Run frontend

npm run dev

## Database

PostgreSQL relational database is used.

Tables:

* users
* groups
* group_members
* expenses
* expense_splits
* settlements
* import_logs
* name_aliases

## AI Usage

AI was used as a development assistant for:

* Architecture discussions
* Query generation
* API design
* Error debugging
* Documentation drafting

All generated code was reviewed, tested, and modified before use.

## Author

Deepak Kumar
