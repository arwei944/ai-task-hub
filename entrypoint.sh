#!/bin/sh
set -e

echo "=== AI Task Hub - Starting ==="

# Ensure data directory exists
mkdir -p /app/data

# Initialize database if not exists
if [ ! -f /app/data/dev.db ]; then
  echo "Initializing database..."
  # Create empty SQLite DB file - Prisma will create tables on first query
  node -e "
    const Database = require('better-sqlite3');
    const db = new Database('/app/data/dev.db');
    db.close();
    console.log('Database file created');
  " 2>&1
  echo "Database initialized."
else
  echo "Database already exists."
fi

echo "Starting server on port ${PORT:-7860}..."
exec node server.js
