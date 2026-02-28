const fs = require('fs');
const path = require('path');
const { db } = require('./db');

const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'init.sql'), 'utf8');

try {
  db.exec(sql);
  console.log('Migrations applied.');
} catch (e) {
  console.error('Migration error:', e.message);
}
