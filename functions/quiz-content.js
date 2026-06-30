const PART_PATHS = Array.from({ length: 5 }, (_, i) => `/payload2/${i}.txt`);

let payloadPromise;

async function readAsset(context, path) {
  const url = new URL(path, context.request.url);
  const response = context.env?.ASSETS?.fetch
    ? await context.env.ASSETS.fetch(url)
    : await context.next(url.toString());

  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return response.text();
}

function toBytes(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizeBase64(value) {
  return String(value)
    .replace(/\s+/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/[^A-Za-z0-9+/=]/g, "");
}

function padded(value) {
  const clean = value.replace(/=/g, "");
  if (!clean.length) return "";
  if (clean.length % 4 === 1) return null;
  return clean + "=".repeat((4 - (clean.length % 4)) % 4);
}

function decodeJoinedBase64(parts) {
  const rawJoined = parts.join("").replace(/\s+/g, "");
  const normalized = normalizeBase64(parts.join(""));
  const noPadding = normalized.replace(/=/g, "");
  const attempts = [];

  attempts.push(rawJoined);
  const p0 = padded(normalized);
  if (p0) attempts.push(p0);

  // Repair mode: the previous oversized uploads occasionally left one or more
  // stray Base64 characters at the boundary/end. Try trimming a few terminal
  // characters before padding. This avoids the invalid length == 1 mod 4 case.
  for (let trim = 1; trim <= 8; trim += 1) {
    const candidate = padded(noPadding.slice(0, -trim));
    if (candidate) attempts.push(candidate);
  }

  const errors = [];
  const seen = new Set();
  for (const candidate of attempts) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      const binary = atob(candidate);
      if (binary.length) return toBytes(binary);
    } catch (error) {
      errors.push(String(error?.message || error));
    }
  }

  throw new Error(`完整題庫 Base64 無法解碼；原始長度=${rawJoined.length}，清理後長度=${noPadding.length}，餘數=${noPadding.length % 4}。${errors[0] || ""}`);
}

async function loadPayload(context) {
  const parts = await Promise.all(PART_PATHS.map((path) => readAsset(context, path)));
  const payload = decodeJoinedBase64(parts);

  if (!payload.byteLength) {
    throw new Error("題庫壓縮資料為空");
  }
  return payload;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

export async function onRequestGet(context) {
  try {
    payloadPromise ||= loadPayload(context);
    const payload = await payloadPromise;

    return new Response(payload, {
      status: 200,
      encodeBody: "manual",
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Encoding": "br",
        "Cache-Control": "public, max-age=300, s-maxage=86400",
        "Vary": "Accept-Encoding",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    payloadPromise = undefined;
    const message = String(error?.message || error);
    console.error("Quiz route failed:", error);

    return new Response(
      `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>題庫載入失敗</title><style>body{font-family:system-ui,"Microsoft JhengHei",sans-serif;max-width:720px;margin:3rem auto;padding:0 1.25rem;color:#9f1d1d;line-height:1.7}code{word-break:break-all;background:#fff0f0;padding:.2rem .4rem}</style><h1>題庫載入失敗</h1><p>伺服器未能準備題庫資料。</p><p><code>${escapeHtml(message)}</code></p><p>請重新整理；若仍失敗，請提供本頁顯示的錯誤文字。</p></html>`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Quiz-Error": message.slice(0, 180),
        },
      },
    );
  }
}
