# Deploying the tools API

This is a Cloudflare Worker + D1 database that backs the four native
tool pages (`/tools/shopping.html`, `/tools/next-up.html`,
`/tools/tips.html`). It's routed at `thegardners.xyz/api/*` — Cloudflare
intercepts those requests at the edge before they'd otherwise hit
GitHub Pages, so the rest of the site keeps working exactly as before.

Because `thegardners.xyz` is already on Cloudflare (it's already
reverse-proxied and Access-gated), this just adds a Worker route and a
D1 database to that same account — no new service to sign up for.

## One-time setup

Run these from the `worker/` directory, with Node.js installed locally.

1. **Log in to Cloudflare** (opens a browser to authorize):
   ```
   npx wrangler login
   ```

2. **Create the D1 database:**
   ```
   npx wrangler d1 create gardners-hub
   ```
   This prints a `database_id`. Copy it into `wrangler.toml`, replacing
   `REPLACE_WITH_YOUR_DATABASE_ID`.

3. **Apply the schema:**
   ```
   npx wrangler d1 execute gardners-hub --remote --file=schema.sql
   ```

4. **Seed it with the current data** (one-time — this migrates what
   was already in the Shopping Lists / Next Up / House Tips Artifacts,
   so nothing gets lost in the switch):
   ```
   npx wrangler d1 execute gardners-hub --remote --file=seed.sql
   ```
   Only run this once against a fresh database — the IDs are fixed, so
   running it twice will fail on duplicate primary keys (which is a
   safe failure, not silent duplication).

5. **Deploy the Worker:**
   ```
   npx wrangler deploy
   ```
   This binds it to the `thegardners.xyz/api/*` route from
   `wrangler.toml`.

6. **Verify the Access policy covers `/api/*`.** In the Cloudflare Zero
   Trust dashboard, check the Access application that gates
   `thegardners.xyz` — if it's scoped to the whole hostname (the usual
   setup for "gate everything"), `/api/*` is already covered. If it's
   scoped to specific paths, add `/api/*` to it. Without this, the API
   would be reachable without going through the PIN login the rest of
   the site requires.

7. **Test it** — visit `https://thegardners.xyz/api/tips` in a browser
   you're already logged into Access with. You should get back JSON,
   not an Access login page or a 522/404.

## After that

Once the Worker is deployed and the site's changes (this branch) are
merged and live on GitHub Pages, the Tools cards on the homepage link
straight to `/tools/*.html`, which talk to `/api/*` — no more claude.ai,
no more tab-switch, and edits show up for everyone within ~8 seconds
(the pages poll on that interval to pick up changes from other people).

## Making schema changes later

Edit `schema.sql`, then run the relevant `ALTER TABLE` (or a fresh
`CREATE TABLE` + data migration) by hand against the `--remote`
database with `wrangler d1 execute`. There's no migration framework
here — this is a small enough schema that hand-run SQL is simpler than
one.
