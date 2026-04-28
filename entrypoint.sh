#!/bin/sh
set -e

echo "=== AI Task Hub - Starting ==="

# Ensure data directory exists
mkdir -p /app/data

# Initialize database if not exists
if [ ! -f /app/data/dev.db ]; then
  echo "Initializing database..."
  node -e "
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const { PrismaClient } = require('./src/generated/prisma/client');
    const path = 'file:/app/data/dev.db';
    const adapter = new PrismaBetterSqlite3({ url: path });
    const prisma = new PrismaClient({ adapter });
    prisma.\$connect().then(() => {
      console.log('Database connected successfully');
      return prisma.\$disconnect();
    }).catch(e => {
      console.error('DB init error:', e.message);
      // Don't exit - let the server handle it
    });
  " 2>&1
  echo "Database initialization complete."
else
  echo "Database already exists."
fi

echo "Starting server on port ${PORT:-7860}..."
exec node server.js
