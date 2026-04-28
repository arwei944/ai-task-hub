// ============================================================
// Input Sanitization Utilities
// ============================================================
//
// Defense against XSS, SQL injection, and other input attacks.
//

/**
 * Sanitize string by removing potential XSS vectors
 */
export function sanitizeString(input: string): string {
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters (except newline, tab, carriage return)
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize unicode
    .normalize('NFC');
}

/**
 * Strip HTML tags from input
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Escape HTML entities
 */
export function escapeHtml(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return input.replace(/[&<>"']/g, (char) => map[char] ?? char);
}

/**
 * Check for common SQL injection patterns
 */
export function hasSQLInjection(input: string): boolean {
  const patterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|UNION)\b.*\b(FROM|INTO|TABLE|DATABASE|WHERE)\b)/i,
    /(--|;|\/\*|\*\/|xp_|sp_)/,
    /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
    /('\s*(OR|AND)\s+')/i,
    /(\bWAITFOR\b\s+\bDELAY\b)/i,
    /(\bBENCHMARK\b\s*\()/i,
  ];
  return patterns.some(p => p.test(input));
}

/**
 * Check for common XSS patterns
 */
export function hasXSS(input: string): boolean {
  const patterns = [
    /<script[\s>]/i,
    /javascript\s*:/i,
    /on\w+\s*=/i,
    /<iframe[\s>]/i,
    /<object[\s>]/i,
    /<embed[\s>]/i,
    /<form[\s>]/i,
    /data\s*:\s*text\/html/i,
    /expression\s*\(/i,
    /url\s*\(\s*['"]?\s*javascript/i,
  ];
  return patterns.some(p => p.test(input));
}

/**
 * Validate and sanitize a URL
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate username format (alphanumeric + underscore, 3-32 chars)
 */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,32}$/.test(username);
}

/**
 * Validate password strength
 */
export function getPasswordStrength(password: string): {
  score: number; // 0-4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push('密码至少需要 8 个字符');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('建议包含大写字母');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('建议包含小写字母');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('建议包含数字');

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else feedback.push('建议包含特殊字符');

  return { score: Math.min(score, 4), feedback };
}

/**
 * Truncate string to max length
 */
export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength);
}
