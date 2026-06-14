// src/db/pool.js
// Single pg connection pool used across the whole app.
// Every route imports this — never create a new Pool elsewhere.

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway / Render add SSL; local Postgres usually doesn't need it
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

// Quick connection test — fails loud so you know immediately if DB is wrong
pool.connect()
  .then(client => {
    console.log('✅ Connected to PostgreSQL');
    client.release();
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection failed:', err.message);
    process.exit(1);
  });

module.exports = pool;
