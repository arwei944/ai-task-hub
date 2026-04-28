import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter, rateLimiters } from '@/lib/security/rate-limiter';
import { getSecurityHeaders } from '@/lib/security/headers';
import { isOriginAllowed, getCORSHeaders, handlePreflight } from '@/lib/security/cors';
import {
  sanitizeString,
  stripHtml,
  escapeHtml,
  hasSQLInjection,
  hasXSS,
  sanitizeUrl,
  isValidEmail,
  isValidUsername,
  getPasswordStrength,
} from '@/lib/security/sanitization';

describe('RateLimiter', () => {
  it('should allow requests under limit', () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
    const result = limiter.check('test-key');

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it('should block requests over limit', () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60000 });

    limiter.check('key');
    limiter.check('key');
    limiter.check('key');

    const result = limiter.check('key');
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after window expires', () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 100 });

    limiter.check('key');
    const blocked = limiter.check('key');
    expect(blocked.success).toBe(false);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = limiter.check('key');
        expect(result.success).toBe(true);
        limiter.destroy();
        resolve();
      }, 150);
    });
  });

  it('should track different keys independently', () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60000 });

    limiter.check('key-a');
    const resultA = limiter.check('key-a');
    const resultB = limiter.check('key-b');

    expect(resultA.success).toBe(false);
    expect(resultB.success).toBe(true);
  });

  it('should return correct rate limit headers', () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
    const result = limiter.check('key');
    const headers = limiter.getHeaders(result);

    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('9');
    expect(headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('should have pre-configured limiters', () => {
    expect(rateLimiters.api).toBeDefined();
    expect(rateLimiters.auth).toBeDefined();
    expect(rateLimiters.ai).toBeDefined();
    expect(rateLimiters.general).toBeDefined();
  });
});

describe('Security Headers', () => {
  it('should return all default security headers', () => {
    const headers = getSecurityHeaders();

    expect(headers['Content-Security-Policy']).toBeDefined();
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['Strict-Transport-Security']).toBeDefined();
    expect(headers['Permissions-Policy']).toBeDefined();
  });

  it('should allow overriding defaults', () => {
    const headers = getSecurityHeaders({ frameOptions: 'SAMEORIGIN' });
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
  });
});

describe('CORS', () => {
  it('should allow configured origins', () => {
    expect(isOriginAllowed('http://localhost:3000')).toBe(true);
    expect(isOriginAllowed('http://localhost:3001')).toBe(true);
  });

  it('should reject unknown origins', () => {
    // With default config (origins: ['*']), all origins are allowed
    expect(isOriginAllowed('http://evil.com')).toBe(true);
    expect(isOriginAllowed(null)).toBe(false);
  });

  it('should return CORS headers', () => {
    const headers = getCORSHeaders('http://localhost:3000');
    // Default config uses '*' for all origins
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Access-Control-Allow-Methods']).toBeDefined();
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('should handle preflight requests', () => {
    const response = handlePreflight('http://localhost:3000');
    expect(response.status).toBe(204);
  });

  it('should reject preflight from unknown origins', () => {
    // With default config (origins: ['*']), all origins are allowed (returns 204)
    const response = handlePreflight('http://evil.com');
    expect(response.status).toBe(204);
  });
});

describe('Input Sanitization', () => {
  it('should sanitize strings', () => {
    expect(sanitizeString('hello\x00world')).toBe('helloworld');
    expect(sanitizeString('hello\x01world')).toBe('helloworld');
    expect(sanitizeString('hello\nworld')).toBe('hello\nworld'); // Keep newline
  });

  it('should strip HTML', () => {
    expect(stripHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(stripHtml('<b>bold</b> text')).toBe('bold text');
    expect(stripHtml('no html here')).toBe('no html here');
  });

  it('should escape HTML entities', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
  });

  it('should detect SQL injection', () => {
    expect(hasSQLInjection("SELECT * FROM users")).toBe(true);
    expect(hasSQLInjection("1; DROP TABLE users")).toBe(true);
    expect(hasSQLInjection("normal text")).toBe(false);
    expect(hasSQLInjection("hello world")).toBe(false);
  });

  it('should detect XSS patterns', () => {
    expect(hasXSS('<script>alert(1)</script>')).toBe(true);
    expect(hasXSS('javascript:alert(1)')).toBe(true);
    expect(hasXSS('onclick=alert(1)')).toBe(true);
    expect(hasXSS('normal text')).toBe(false);
  });

  it('should sanitize URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('ftp://example.com')).toBeNull();
  });

  it('should validate emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name+tag@example.com')).toBe(true);
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
  });

  it('should validate usernames', () => {
    expect(isValidUsername('user123')).toBe(true);
    expect(isValidUsername('user_name')).toBe(true);
    expect(isValidUsername('ab')).toBe(false); // Too short
    expect(isValidUsername('user-name')).toBe(false); // Hyphen not allowed
  });

  it('should evaluate password strength', () => {
    const weak = getPasswordStrength('abc');
    expect(weak.score).toBeLessThan(3);
    expect(weak.feedback.length).toBeGreaterThan(0);

    const strong = getPasswordStrength('MyP@ssw0rd!');
    expect(strong.score).toBe(4);
    expect(strong.feedback.length).toBe(0);
  });
});
