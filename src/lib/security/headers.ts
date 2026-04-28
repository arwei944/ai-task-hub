// ============================================================
// Security Headers
// ============================================================
//
// Helmet-style security headers for Next.js responses.
//

export interface SecurityHeadersConfig {
  /** Content-Security-Policy */
  contentSecurityPolicy?: string;
  /** Referrer-Policy */
  referrerPolicy?: string;
  /** X-Content-Type-Options */
  contentTypeOptions?: 'nosniff';
  /** X-Frame-Options */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  /** X-XSS-Protection */
  xssProtection?: '0' | '1' | '1; mode=block';
  /** Strict-Transport-Security */
  strictTransportSecurity?: string;
  /** Permissions-Policy */
  permissionsPolicy?: string;
}

const DEFAULT_CONFIG: SecurityHeadersConfig = {
  contentSecurityPolicy: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'self' https://huggingface.co https://*.huggingface.co",
  ].join('; '),
  referrerPolicy: 'strict-origin-when-cross-origin',
  contentTypeOptions: 'nosniff',
  frameOptions: 'SAMEORIGIN',
  xssProtection: '0', // Modern browsers use CSP instead
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  permissionsPolicy: [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
  ].join(', '),
};

/**
 * Get all security headers
 */
export function getSecurityHeaders(config: Partial<SecurityHeadersConfig> = {}): Record<string, string> {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const headers: Record<string, string> = {};

  if (merged.contentSecurityPolicy) {
    headers['Content-Security-Policy'] = merged.contentSecurityPolicy;
  }
  if (merged.referrerPolicy) {
    headers['Referrer-Policy'] = merged.referrerPolicy;
  }
  if (merged.contentTypeOptions) {
    headers['X-Content-Type-Options'] = merged.contentTypeOptions;
  }
  if (merged.frameOptions) {
    headers['X-Frame-Options'] = merged.frameOptions;
  }
  if (merged.xssProtection) {
    headers['X-XSS-Protection'] = merged.xssProtection;
  }
  if (merged.strictTransportSecurity) {
    headers['Strict-Transport-Security'] = merged.strictTransportSecurity;
  }
  if (merged.permissionsPolicy) {
    headers['Permissions-Policy'] = merged.permissionsPolicy;
  }

  // Non-configurable headers
  headers['X-DNS-Prefetch-Control'] = 'on';
  headers['X-Download-Options'] = 'noopen';
  headers['X-Permitted-Cross-Domain-Policies'] = 'none';

  return headers;
}

/**
 * Apply security headers to a Response
 */
export function applySecurityHeaders(response: Response, config?: Partial<SecurityHeadersConfig>): Response {
  const headers = getSecurityHeaders(config);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
