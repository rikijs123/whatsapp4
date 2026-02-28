const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const mkdirp = require('mkdirp');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.sqlite');
mkdirp.sync(path.dirname(DB_PATH));

const db = new Database(DB_PATH);

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(params);
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(params);
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(params);
}

module.exports = { db, run, get, all, DB_PATH };
