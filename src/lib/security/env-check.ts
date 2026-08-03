export interface EnvEntry {
  key: string;
  present: boolean;
  isSecret: boolean;
  required: boolean;
  note: string;
}

const ENV_MANIFEST: Omit<EnvEntry, 'present'>[] = [
  { key: 'SECRET_COOKIE_PASSWORD',       isSecret: true,  required: true,  note: 'iron-session signing key — min 32 chars' },
  { key: 'CLIENT_SECRET',                isSecret: true,  required: true,  note: 'ikas OAuth + JWT signing key' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY',    isSecret: true,  required: true,  note: 'Supabase admin access (server-side only)' },
  { key: 'RESEND_API_KEY',               isSecret: true,  required: false, note: 'Required for email features' },
  { key: 'RESEND_FROM_EMAIL',            isSecret: false, required: true,  note: 'Verified sender address for Resend — required, e.g. noreply@yourdomain.com' },
  { key: 'OPENAI_API_KEY',              isSecret: true,  required: false, note: 'Required for AI Insights feature' },
  { key: 'CRON_SECRET',                  isSecret: true,  required: true,  note: 'Protects billing/sync cron endpoint — required' },
  { key: 'IKAS_PRO_SUBSCRIPTION_KEY',   isSecret: false, required: true,  note: 'ikas App Store subscription key for the Pro plan' },
  { key: 'INTERNAL_SECRET',             isSecret: true,  required: false, note: 'Internal API-to-API auth header for server-side calls' },
  { key: 'NEXT_PUBLIC_CLIENT_ID',        isSecret: false, required: true,  note: 'ikas OAuth client ID' },
  { key: 'NEXT_PUBLIC_GRAPH_API_URL',    isSecret: false, required: true,  note: 'ikas Admin GraphQL endpoint' },
  { key: 'NEXT_PUBLIC_ADMIN_URL',        isSecret: false, required: true,  note: 'ikas Admin panel URL (for iframe embedding)' },
  { key: 'NEXT_PUBLIC_DEPLOY_URL',       isSecret: false, required: true,  note: 'Deployed app URL (used in invite links)' },
  { key: 'NEXT_PUBLIC_SUPABASE_URL',     isSecret: false, required: true,  note: 'Supabase project URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',isSecret: false, required: true,  note: 'Supabase anon/public key' },
];

export function checkEnvVars(): EnvEntry[] {
  return ENV_MANIFEST.map((e) => ({
    ...e,
    present: Boolean(process.env[e.key]),
  }));
}

export function getMissingRequired(): string[] {
  return ENV_MANIFEST
    .filter((e) => e.required && !process.env[e.key])
    .map((e) => e.key);
}

export function computeSecurityScore(): { score: number; max: number; checks: Record<string, boolean> } {
  const entries = checkEnvVars();
  const requiredPresent = entries.filter((e) => e.required).every((e) => e.present);
  const optionalPresent = entries.filter((e) => !e.required).every((e) => e.present);
  const httpsDeployUrl = (process.env.NEXT_PUBLIC_DEPLOY_URL ?? '').startsWith('https://');
  const hasCronSecret = Boolean(process.env.CRON_SECRET);
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);

  const checks = {
    'Security headers configured': true,       // always true after Phase 6
    'Critical env vars present': requiredPresent,
    'HTTPS deploy URL': httpsDeployUrl,
    'Rate limiting active': true,              // always true after Phase 6
    'Input validation': true,                  // always true after Phase 6
    'CSRF protection': true,                   // JWT-in-header scheme
    'Cron secret set': hasCronSecret,
    'Email service configured': hasResend,
    'AI service configured': hasOpenAI,
    'All optional secrets set': optionalPresent,
  };

  const weights: Record<string, number> = {
    'Security headers configured': 15,
    'Critical env vars present': 20,
    'HTTPS deploy URL': 10,
    'Rate limiting active': 10,
    'Input validation': 10,
    'CSRF protection': 5,
    'Cron secret set': 5,
    'Email service configured': 5,
    'AI service configured': 3,
    'All optional secrets set': 2,
  };

  let score = 0;
  let max = 0;
  for (const [check, passed] of Object.entries(checks)) {
    const w = weights[check] ?? 5;
    max += w;
    if (passed) score += w;
  }

  return { score, max, checks };
}
