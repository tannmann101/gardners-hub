# Hosting

The website is a Cloudflare **Worker with static assets**, built from this
private repo by Workers Builds (project `notebook-workspace`). The `/api/*`
backend is a separate Worker (`worker/`, see `worker/DEPLOY.md`).

| file | role |
|---|---|
| `wrangler.jsonc` | Worker config: serves the repo root as static files |
| `site-worker.js` | runs before every request; redirects `*.workers.dev` and preview URLs to the Access-gated `thegardners.xyz` |
| `.assetsignore` | keeps config, `worker/` source, and `*.md` guides from being served |
| `_headers` | `X-Robots-Tag: noindex` and `no-cache` for `/notes/*` |

## Dashboard settings (Workers & Pages → notebook-workspace → Settings → Build)

- Root directory: `/` (empty)
- Build command: *(empty)*
- **Deploy command: `npx wrangler deploy`**. This is what publishes `main`.
- Non-production branch deploy command: `npx wrangler preview` (fine as is)

The `name` in `wrangler.jsonc` must match the Worker's name in the dashboard.

## Domain

Settings → Domains & Routes → Add → Custom domain → `thegardners.xyz`.
After it's attached, check:

- `https://thegardners.xyz` asks for the Access PIN.
- `https://thegardners.xyz/notes/` loads behind it.
- `https://thegardners.xyz/api/tips` still returns JSON. If it doesn't,
  the site Worker is answering `/api/*` instead of the API Worker. Tell
  Claude, because the fix is a small config change.

## Cache-busting

`.json` data is fetched with `no-cache`. If you change a `.css` or `.js`
file, bump the `?v=` on its tag in the HTML.
