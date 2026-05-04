import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    '@prisma/adapter-better-sqlite3',
    '@prisma/client',
    'better-sqlite3',
    'bcryptjs',
    'nodemailer',
    'web-push',
  ],
  turbopack: {
    resolveAlias: {
      '@modelcontextprotocol/sdk': '@modelcontextprotocol/sdk',
    },
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'clsx', 'tailwind-merge', 'zod'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      { source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/favicon.ico', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] },
    ];
  },
};

export default nextConfig;
