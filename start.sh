#!/bin/sh
set -e

echo "=== AI Task Hub Starting ==="
echo "Node: $(node -v)"
echo "ENV: NODE_ENV=$NODE_ENV"
echo "ENV: DATABASE_URL=$DATABASE_URL"
echo "ENV: PORT=$PORT"
echo "CWD: $(pwd)"
echo ""

# Ensure persistent data directory exists
mkdir -p /data

# Initialize database if not exists
if [ ! -f /data/dev.db ]; then
  echo "Initializing database on persistent storage..."
  node -e "
    const Database = require('better-sqlite3');
    const db = new Database('/data/dev.db');
    db.close();
    console.log('Database file created at /data/dev.db');
  " 2>&1
else
  echo "Database found at /data/dev.db"
fi

# Verify critical files
echo "Checking files..."
test -f /app/node_modules/better-sqlite3/build/Release/better_sqlite3.node && echo "✓ better-sqlite3 OK" || echo "✗ better-sqlite3 MISSING"
test -d /app/src/generated/prisma && echo "✓ Prisma client OK" || echo "✗ Prisma client MISSING"
test -f /data/dev.db && echo "✓ Database OK" || echo "✗ Database MISSING"
test -d /app/.next && echo "✓ Next.js build OK" || echo "✗ Next.js build MISSING"
echo ""

# Test database connection
echo "Testing database..."
node -e "
try {
  const Database = require('better-sqlite3');
  const db = new Database('/data/dev.db');
  const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();
  console.log('✓ DB connected, tables:', tables.map(t => t.name).join(', '));
  db.close();
} catch(e) {
  console.error('✗ DB error:', e.message);
  process.exit(1);
}
"
echo ""

# Start server
echo "Starting server on port ${PORT:-7860}..."
exec npx next start -p ${PORT:-7860} -H 0.0.0.0
