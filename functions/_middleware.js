// Cloudflare Pages middleware: runs before every request to the site.
//
// Cloudflare Access gates thegardners.xyz, but a Pages project is also
// reachable at <project>.pages.dev and <deploy>.<project>.pages.dev, which
// that Access policy does not cover. Send any such request to the canonical
// (gated) hostname so the private pages under /notes/ can't be read around it.
const CANONICAL = 'thegardners.xyz';
const LOCAL = ['localhost', '127.0.0.1', '[::1]'];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname;

  if (host !== CANONICAL && !LOCAL.includes(host)) {
    url.hostname = CANONICAL;
    url.protocol = 'https:';
    url.port = '';
    return Response.redirect(url.toString(), 308);
  }

  return context.next();
}
