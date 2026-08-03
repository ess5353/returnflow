import dns from 'dns/promises';
import net from 'net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  'metadata.google.internal',
  'metadata.internal',
]);

/**
 * Returns true when the IP address falls within any range that must not receive
 * outbound requests: loopback, private (RFC-1918), link-local / APIPA,
 * CGNAT (RFC-6598), IANA reserved, or IPv6 equivalents.
 */
function isBlockedIP(ip: string): boolean {
  if (!net.isIP(ip)) return true; // unparseable → block

  // ── IPv4 ────────────────────────────────────────────────────────────────
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127) return true;                          // loopback 127.0.0.0/8
    if (a === 10) return true;                           // RFC-1918 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;  // RFC-1918 172.16.0.0/12
    if (a === 192 && b === 168) return true;             // RFC-1918 192.168.0.0/16
    if (a === 169 && b === 254) return true;             // link-local / IMDS 169.254.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT RFC-6598
    if (a === 0) return true;                            // "this" network
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmark RFC-2544
    if (ip === '255.255.255.255') return true;           // broadcast
    return false;
  }

  // ── IPv6 ────────────────────────────────────────────────────────────────
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;                        // loopback
  if (lower === '::') return true;                         // unspecified
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA FC00::/7
  if (lower.startsWith('fe80')) return true;               // link-local FE80::/10
  if (lower.startsWith('ff')) return true;                 // multicast
  if (lower === '::ffff:127.0.0.1') return true;           // IPv4-mapped loopback

  return false;
}

export interface UrlValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Validates a webhook URL against SSRF-prevention rules.
 *
 * Performs a DNS lookup and checks every resolved address. Call this both when
 * the user saves a webhook and immediately before each delivery attempt to
 * protect against DNS rebinding.
 */
export async function validateWebhookUrl(rawUrl: string): Promise<UrlValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'Invalid URL format' };
  }

  const { protocol, hostname, port } = parsed;

  if (protocol !== 'https:' && protocol !== 'http:') {
    return { ok: false, error: 'Only http and https protocols are allowed' };
  }

  // Reject explicit IP literals that are in blocked ranges (fast path — no DNS needed)
  if (net.isIP(hostname)) {
    if (isBlockedIP(hostname)) {
      return { ok: false, error: 'URL points to a private or reserved IP address' };
    }
    return { ok: true };
  }

  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    return { ok: false, error: 'URL points to a blocked hostname' };
  }

  // Resolve DNS and validate every returned address
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    return { ok: false, error: 'Could not resolve hostname' };
  }

  if (addresses.length === 0) {
    return { ok: false, error: 'Hostname did not resolve to any address' };
  }

  for (const { address } of addresses) {
    if (isBlockedIP(address)) {
      return { ok: false, error: 'URL resolves to a private or reserved IP address' };
    }
  }

  // Block unusual ports that could reach internal admin interfaces
  const portNum = port ? parseInt(port, 10) : (protocol === 'https:' ? 443 : 80);
  const allowedPorts = new Set([80, 443, 8080, 8443, 3000]);
  if (!allowedPorts.has(portNum)) {
    return { ok: false, error: `Port ${portNum} is not allowed` };
  }

  return { ok: true };
}
