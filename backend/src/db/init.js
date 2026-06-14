// src/db/init.js
// Run once: node src/db/init.js
// Reads schema.sql and executes it against the connected database.

const fs   = require('fs');
const path = require('path');
const pool = require('./pool');

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Schema created (or already exists)');
  } catch (err) {
    console.error('❌ Schema init failed:', err.message);
  } finally {
    await pool.end();
  }
}

init();
