import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimiters } from '@/lib/security/rate-limiter';
import { getSecurityHeaders } from '@/lib/security/headers';
import { handlePreflight, applyCORS, isOriginAllowed } from '@/lib/security/cors';

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/mcp',
  '/api/webhook',
  '/api/status',
  '/api/export',
  '/api/sse',
];

// Rate limit configuration per path pattern
function getRateLimiter(pathname: string) {
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/login')) return rateLimiters.auth;
  if (pathname.startsWith('/api/ai')) return rateLimiters.ai;
  if (pathname.startsWith('/api/webhook')) return rateLimiters.webhook;
  if (pathname.startsWith('/api/')) return rateLimiters.api;
  return rateLimiters.general;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handlePreflight(origin);
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const limiter = getRateLimiter(pathname);
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown';
    const result = limiter.check(clientIp);

    if (!result.success) {
      const response = NextResponse.json(
        { error: '请求过于频繁，请稍后重试', code: 'RATE_LIMITED' },
        { status: 429 },
      );
      // Apply rate limit headers
      for (const [key, value] of Object.entries(limiter.getHeaders(result))) {
        response.headers.set(key, value);
      }
      return response;
    }
  }

  // Allow public paths (but still apply security headers)
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    const response = NextResponse.next();
    return applySecurityAndCORS(response, origin);
  }

  // Check for token in cookie or authorization header
  const token =
    request.cookies.get('token')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  // If no token, redirect to login (for page routes) or return 401 (for API routes)
  if (!token) {
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json(
        { error: '请先登录', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
      return applySecurityAndCORS(response, origin);
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  return applySecurityAndCORS(response, origin);
}

/**
 * Apply security headers and CORS to a response
 */
function applySecurityAndCORS(response: NextResponse, origin: string | null): NextResponse {
  // Security headers
  const secHeaders = getSecurityHeaders();
  for (const [key, value] of Object.entries(secHeaders)) {
    response.headers.set(key, value);
  }

  // CORS
  if (origin && isOriginAllowed(origin)) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
    };
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
