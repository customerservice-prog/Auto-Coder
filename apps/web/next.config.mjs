/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Reduces passive fingerprinting; no secret value. */
  poweredByHeader: false,
  experimental: {
    /** Smaller client/server chunks when these packages re-export many modules. */
    optimizePackageImports: [
      '@clerk/nextjs',
      'ai',
      '@ai-sdk/anthropic',
      '@ai-sdk/openai',
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    const security = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ];

    /** Vercel sets `VERCEL=1`. HSTS on non-HTTPS or wrong host can break local/self-hosted stacks — keep scoped. */
    if (process.env.VERCEL === '1') {
      security.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains',
      });
    }

    /** `force-static` legal pages — long-lived at shared caches; browsers refresh hourly. */
    const legalCache = {
      key: 'Cache-Control',
      value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    };

    /** Metadata routes (`app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`). */
    const seoCache = {
      key: 'Cache-Control',
      value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    };

    return [
      { source: '/privacy', headers: [...security, legalCache] },
      { source: '/terms', headers: [...security, legalCache] },
      { source: '/sitemap.xml', headers: [...security, seoCache] },
      { source: '/robots.txt', headers: [...security, seoCache] },
      { source: '/manifest.webmanifest', headers: [...security, seoCache] },
      { source: '/:path*', headers: security },
    ];
  },
};

export default nextConfig;
