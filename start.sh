#!/bin/sh
set -e

echo "=== AI Task Hub Starting ==="
echo "Node: $(node -v)"
echo "ENV: NODE_ENV=$NODE_ENV"
echo "ENV: DATABASE_URL=$DATABASE_URL"
echo "ENV: PORT=$PORT"
echo "CWD: $(pwd)"
echo ""

# Verify critical files exist
echo "Checking files..."
test -f /app/node_modules/better-sqlite3/build/Release/better_sqlite3.node && echo "✓ better-sqlite3 native module OK" || echo "✗ better-sqlite3 native module MISSING"
test -f /app/src/generated/prisma/client.js && echo "✓ Prisma client OK" || echo "✗ Prisma client MISSING"
test -f /app/data/dev.db && echo "✓ Database OK" || echo "✗ Database MISSING"
echo ""

# Test database connection
echo "Testing database..."
node -e "
try {
  const Database = require('better-sqlite3');
  const db = new Database('/app/data/dev.db');
  const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();
  console.log('✓ Database connected, tables:', tables.map(t => t.name).join(', '));
  db.close();
} catch(e) {
  console.error('✗ Database error:', e.message);
  process.exit(1);
}
"
echo ""

# Start the server
echo "Starting Next.js server on port ${PORT:-7860}..."
exec npx next start -p ${PORT:-7860} -H 0.0.0.0
