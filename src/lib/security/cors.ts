// ============================================================
// CORS Configuration
// ============================================================

export interface CORSConfig {
  /** Allowed origins (use '*' for all) */
  origins: string[];
  /** Allowed methods */
  methods?: string[];
  /** Allowed headers */
  allowedHeaders?: string[];
  /** Exposed headers */
  exposedHeaders?: string[];
  /** Max age for preflight cache (seconds) */
  maxAge?: number;
  /** Allow credentials */
  credentials?: boolean;
}

const DEFAULT_CORS: CORSConfig = {
  origins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:3000', 'http://localhost:7860'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400,
  credentials: true,
};

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null, config: CORSConfig = DEFAULT_CORS): boolean {
  if (!origin) return false;
  if (config.origins.includes('*')) return true;
  return config.origins.includes(origin);
}

/**
 * Get CORS headers for a request
 */
export function getCORSHeaders(origin: string, config: CORSConfig = DEFAULT_CORS): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': config.origins.includes('*') ? '*' : origin,
    'Access-Control-Allow-Methods': (config.methods ?? DEFAULT_CORS.methods!).join(', '),
    'Access-Control-Allow-Headers': (config.allowedHeaders ?? DEFAULT_CORS.allowedHeaders!).join(', '),
    'Access-Control-Allow-Credentials': String(config.credentials ?? true),
    'Access-Control-Max-Age': String(config.maxAge ?? 86400),
    'Access-Control-Expose-Headers': (config.exposedHeaders ?? DEFAULT_CORS.exposedHeaders!).join(', '),
  };
}

/**
 * Apply CORS to a response
 */
export function applyCORS(
  response: Response,
  origin: string | null,
  config: CORSConfig = DEFAULT_CORS,
): Response {
  if (!origin || !isOriginAllowed(origin, config)) {
    return response;
  }

  const headers = getCORSHeaders(origin, config);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

/**
 * Handle CORS preflight request
 */
export function handlePreflight(origin: string | null, config: CORSConfig = DEFAULT_CORS): Response {
  if (!origin || !isOriginAllowed(origin, config)) {
    return new Response(null, { status: 403 });
  }

  const headers = getCORSHeaders(origin, config);
  return new Response(null, {
    status: 204,
    headers,
  });
}
