export function onRequestGet(context) {
  const target = new URL("/", context.request.url);
  target.search = new URL(context.request.url).search;
  target.hash = new URL(context.request.url).hash;
  return Response.redirect(target.toString(), 302);
}
