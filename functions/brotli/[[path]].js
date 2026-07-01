const VERSION = "2.3.2";
const UPSTREAM = "https://unpkg.com/brotli-dec-wasm@" + VERSION + "/";

function contentType(path, upstreamType) {
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".wasm")) return "application/wasm";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  return upstreamType || "application/octet-stream";
}

export async function onRequestGet(context) {
  const raw = context.params.path;
  const path = (Array.isArray(raw) ? raw.join("/") : String(raw || "index.js"))
    .replace(/^\/+/, "");

  if (!path || path.includes("..")) {
    return new Response("Invalid Brotli asset path", { status: 400 });
  }

  const upstreamUrl = new URL(path, UPSTREAM);
  const upstream = await fetch(upstreamUrl.toString(), {
    headers: { "User-Agent": "GPA-Quiz-Asset-Proxy/1.0" },
    cf: { cacheEverything: true, cacheTtl: 604800 },
  });

  if (!upstream.ok) {
    return new Response(`Brotli asset unavailable: ${upstream.status}`, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType(path, upstream.headers.get("Content-Type")));
  headers.set("Cache-Control", "public, max-age=604800, s-maxage=604800");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(upstream.body, { status: 200, headers });
}
