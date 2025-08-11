#!/usr/bin/env node
// Simple migration runner: applies db/schema.sql to DATABASE_URL
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Aborting.');
    process.exit(1);
  }
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('Schema file not found at', schemaPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const client = new Client({ connectionString: databaseUrl, ssl: process.env.PGSSL ? { rejectUnauthorized: false } : undefined });
  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
