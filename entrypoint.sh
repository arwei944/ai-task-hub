#!/bin/sh
set -e

echo "=== AI Task Hub - Starting ==="

# Ensure data directory exists on persistent storage
mkdir -p /data

# Initialize database if not exists
if [ ! -f /data/dev.db ]; then
  echo "Initializing database..."
  # Create empty SQLite DB file - Prisma will create tables on first query
  node -e "
    const Database = require('better-sqlite3');
    const db = new Database('/data/dev.db');
    db.close();
    console.log('Database file created');
  " 2>&1
  echo "Database initialized."
else
  echo "Database already exists at /data/dev.db"
fi

echo "Starting server on port ${PORT:-7860}..."
exec node server.js
