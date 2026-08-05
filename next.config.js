/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['*.trycloudflare.com'],

  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const graphApiUrl = process.env.NEXT_PUBLIC_GRAPH_API_URL ?? '';

    // Allow ikas admin to embed this app in an iframe
    const frameAncestors = [
      "'self'",
      'https://*.myikas.com',
      'https://admin.myikas.com',
      // Dev: allow any origin so local testing works
      ...(process.env.NODE_ENV === 'development' ? ["'unsafe-inline'", '*'] : []),
    ].join(' ');

    const connectSrc = [
      "'self'",
      supabaseUrl,
      graphApiUrl,
      'https://api.resend.com',
      'https://*.myikas.com',
      // Next.js HMR in development
      ...(process.env.NODE_ENV === 'development' ? ['ws:', 'wss:'] : []),
    ].filter(Boolean).join(' ');

    const csp = [
      "default-src 'self'",
      // Next.js requires unsafe-inline and unsafe-eval for its runtime bundles
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      `connect-src ${connectSrc}`,
      "font-src 'self' data:",
      // email preview uses blob: src-doc iframes
      "frame-src 'self' blob:",
      `frame-ancestors ${frameAncestors}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    const securityHeaders = [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
    ];

    // HSTS only in production (not local dev)
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }

    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

module.exports = nextConfig;
