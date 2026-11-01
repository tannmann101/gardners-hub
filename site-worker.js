// Runs in front of every request to the website (see wrangler.jsonc).
//
// Cloudflare Access gates thegardners.xyz, but a Worker is also reachable at
// its *.workers.dev address and at per-version preview URLs, which that Access
// policy does not cover. Send those to the canonical (gated) hostname so the
// private pages under /notes/ can't be read around the login.
const CANONICAL = 'thegardners.xyz';
const LOCAL = ['localhost', '127.0.0.1', '[::1]'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname !== CANONICAL && !LOCAL.includes(url.hostname)) {
      url.hostname = CANONICAL;
      url.protocol = 'https:';
      url.port = '';
      return Response.redirect(url.toString(), 308);
    }
    return env.ASSETS.fetch(request);
  },
};
