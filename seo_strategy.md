# SEO Strategy

## Project Summary
This is an internal proxy management tool consisting of:
- `artifacts/proxy-dashboard` — React SPA admin panel for managing proxy pools, scheduling health checks, and monitoring traffic (publicly accessible but intended as an internal/admin tool)
- `artifacts/api-server` — Express 5 REST API backend
- `artifacts/mockup-sandbox` — UI prototyping canvas (internal design tool)

## In Scope
- `artifacts/proxy-dashboard/index.html` — the SPA shell (single public-facing HTML page)
- `artifacts/mockup-sandbox/index.html` — the mockup canvas shell

## Out of Scope
- API routes (`/api/**`) — machine-readable JSON endpoints, not indexable pages
- Authenticated dashboards (N/A — no auth layer currently)
- Programmatic SEO pages (none exist)

## Rendering Mode
**SPA** — `artifacts/proxy-dashboard` is a client-rendered React app. Crawlers see only the static HTML shell (`index.html`). All content (proxy list, stats, forms) is invisible to Googlebot and AI crawlers.

## Target Audience
Internal operators managing proxy pools. This is **not** a public-facing product site intended to rank in search engines.

## Primary Keywords
None — internal tool, not targeting search traffic.

## Crawler Intent
The proxy dashboard should **not** be indexed by search engines (sensitive internal admin tool). A `robots.txt` with `Disallow: /` or a `<meta name="robots" content="noindex">` tag is warranted.

## Dismissed Categories
- Structured data (not applicable for an internal admin tool)
- Open Graph / Twitter cards (no social sharing needed)
- `llms.txt` (not a public content site)
- Sitemap (no public content pages to index)
- Canonical tags (single-page SPA, not a multi-page content site)
