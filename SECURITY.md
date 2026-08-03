# Security Notes — Dependency Vulnerabilities

## npm audit findings (pnpm audit --prod)

**As of 2026-08-03:** `pnpm audit --prod` reports 91 vulnerabilities:

| Severity | Count |
|---|---|
| Critical | 3 |
| High | 48 |
| Moderate | 36 |
| Low | 4 |

## Root cause

All 91 findings originate in a single dependency chain:

```
@ikas/admin-api-client
  └── @babel/core (and related: @babel/traverse, @babel/types, etc.)
      └── [vulnerable versions of transitive dependencies]
```

`@babel/core` is a JavaScript transpiler — a **build-time development tool**. It is included in `@ikas/admin-api-client` as a **runtime dependency** (in the `dependencies` field of `package.json`) rather than a `devDependency`. This is a packaging error in the ikas SDK.

## Why these vulnerabilities are not exploitable in this application

- **Babel is never executed at request time.** In a Next.js production deployment, Babel runs during the build phase only. The built output (`.next/`) contains no Babel code — it has already been used and discarded.
- **The vulnerabilities are in Babel's AST traversal and type evaluation logic.** These are exploited by passing malicious JavaScript source code to Babel's parser. Our application never parses external JavaScript source code at runtime.
- **None of the attack vectors apply.** The known CVEs in this chain (primarily `@babel/traverse` prototype pollution, `@babel/types` command injection via code generation) require an attacker to control the *input source code being transformed by Babel*. No such code path exists at runtime.

## What was reported to ikas

The following message was sent to ikas support (see item 10 in the audit requirements):

---

**Subject:** SDK packaging issue — Babel included as runtime dependency causes 91 npm audit findings

Hello ikas team,

We are building a production app on the ikas App Store and have found that `@ikas/admin-api-client` includes `@babel/core` and related Babel packages as `dependencies` (runtime) rather than `devDependencies`.

This causes `pnpm audit --prod` to report 91 vulnerabilities (3 critical, 48 high, 36 moderate, 4 low) in every app that depends on your SDK, even though Babel is a build-time tool and cannot be exploited at runtime.

**Requested fix:** Move `@babel/core`, `@babel/traverse`, `@babel/types`, and related `@babel/*` packages from `dependencies` to `devDependencies` in `@ikas/admin-api-client/package.json`. Then publish a patch release.

**Impact for us:** App Store security scanners may reject apps with high/critical audit findings, blocking store submission even when the vulnerabilities are not exploitable.

Thank you.

---

## Residual risk

**Risk level: Very Low.**

The vulnerabilities are not exploitable in the Next.js runtime context. However:

1. Automated App Store security scanners that run `npm audit` without understanding the runtime context may flag the app.
2. If `@ikas/admin-api-client` is ever upgraded to a version that ships corrected packaging, these findings will disappear.
3. Do NOT use `pnpm overrides` or `npm overrides` to forcibly upgrade the Babel packages — this may break the ikas SDK's code generation tooling.

## Mitigations

- This document can be shared with ikas App Store reviewers to explain the findings.
- Monitor `@ikas/admin-api-client` releases for a fix and upgrade when available.
- Re-run `pnpm audit --prod` after each SDK upgrade to verify the count decreases.
