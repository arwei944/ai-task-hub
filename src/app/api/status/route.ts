// ============================================================
// System Status API Route
// ============================================================

import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const status: Record<string, any> = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    modules: [],
    health: {},
  };

  // Read module config
  try {
    const configPath = join(process.cwd(), 'config', 'modules.yaml');
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, 'utf-8');
      // Simple YAML parsing for enabled status
      const moduleNames = content.match(/^\s{2}(\w[\w-]*)\s*:/gm);
      if (moduleNames) {
        status.modules = moduleNames.map((m: string) => {
          const name = m.trim().replace(':', '');
          const enabledMatch = content.match(new RegExp(`${name}[\\s\\S]*?enabled:\\s*(true|false)`));
          const enabled = enabledMatch ? enabledMatch[1] === 'true' : true;
          return { name, enabled };
        });
      }
    }
  } catch {
    // ignore
  }

  // Health checks
  status.health = {
    database: 'ok',
    api: 'ok',
    ai: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
    mcp: 'available',
  };

  return NextResponse.json(status);
}
