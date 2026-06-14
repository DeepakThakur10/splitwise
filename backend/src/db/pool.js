// src/db/pool.js
// Single pg connection pool used across the whole app.
// Every route imports this — never create a new Pool elsewhere.

const { Pool } = require('pg');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL || '';
const requiresSsl = databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech') || databaseUrl.includes('railway');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false,
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
