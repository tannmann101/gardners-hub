# Hosting: moving from GitHub Pages to Cloudflare Pages

Why: the site now has private material under `/notes/`. GitHub Pages on a
free plan needs a public repo, which would expose that material on
github.com no matter what Cloudflare Access does on the site. Cloudflare
Pages can build from a private repo.

Do the steps in this order. The private commit isn't pushed until step 5, so
nothing personal is public at any point.

## 1. Create the Pages project (repo still public, nothing private in it yet)

Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.

- Repository: `tannmann101/gardners-hub`. When GitHub asks, let the
  Cloudflare Pages app access this repo.
- Production branch: `main`
- Framework preset: **None**
- Build command: *(leave empty)*
- Build output directory: `/`

Deploy. It'll be live at `<project>.pages.dev`. Open it and check the home
page looks right.

## 2. Point thegardners.xyz at Pages

In the Pages project → **Custom domains → Set up a custom domain** →
`thegardners.xyz`. Cloudflare offers to replace the existing DNS record
(currently GitHub Pages). Accept.

Then check:
- `https://thegardners.xyz` loads and still asks for the Access PIN.
- `https://thegardners.xyz/api/tips` still returns JSON (the Worker route
  for `/api/*` is unchanged and runs in front of Pages).

## 3. Lock down previews

Pages project → **Settings → General → Access policy → Enable** for
preview deployments. (The `functions/_middleware.js` in this repo also
redirects every `*.pages.dev` address to `thegardners.xyz`, so they fall
under the same Access login. This setting is a second layer.)

## 4. Make the GitHub repo private

GitHub → repo **Settings → General → Danger Zone → Change visibility →
Private**. GitHub Pages switches off by itself on a free plan. That's fine
now, because Cloudflare is serving the site. The Cloudflare Pages and Claude
GitHub apps keep their access.

## 5. Push the Notes Workspace

Tell Claude the repo is private. Claude checks, then pushes the branch and,
if you want, opens and merges the PR. Cloudflare Pages deploys `main`
automatically.

After the move, the `CNAME` file is unused. It's harmless, and can be
deleted later.
