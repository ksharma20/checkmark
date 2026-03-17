#!/usr/bin/env node
// Run the QA/fix database migrations
// Usage: node scripts/run-migrate-updates.js

const path = require('path')
const fs = require('fs')

try {
  fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
    .split('\n')
    .forEach((line) => {
      const [key, ...rest] = line.split('=')
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
    })
} catch { /* no .env.local — fine for SQLite */ }

const Database = require('better-sqlite3')
const dbPath = path.join(__dirname, '../checkmark.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const sql = fs.readFileSync(path.join(__dirname, 'migrate-updates.sql'), 'utf8')

const statements = sql
  .split('\n')
  .filter(line => !line.trim().startsWith('--') && line.trim())
  .join('\n')
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0)

let ran = 0
let skipped = 0

for (const stmt of statements) {
  try {
    db.prepare(stmt).run()
    console.log(`✓ ${stmt.split('\n')[0].slice(0, 80)}`)
    ran++
  } catch (err) {
    if (err.message.includes('duplicate column') || err.message.includes('already exists')) {
      console.log(`⟳ skipped (already exists): ${stmt.split('\n')[0].slice(0, 80)}`)
      skipped++
    } else {
      console.error(`✗ FAILED: ${stmt}`)
      console.error(err.message)
      process.exit(1)
    }
  }
}

db.close()
console.log(`\n✅ Done — ${ran} executed, ${skipped} skipped (already existed)`)
