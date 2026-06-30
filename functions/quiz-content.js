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

function decodeBase64Part(value, index) {
  let text = String(value)
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "")
    .replace(/=/g, "");

  if (!text.length) {
    throw new Error(`題庫分段 ${index + 1} 為空`);
  }
  if (text.length % 4 === 1) {
    throw new Error(`題庫分段 ${index + 1} 的 Base64 長度不正確`);
  }

  text += "=".repeat((4 - (text.length % 4)) % 4);

  let binary;
  try {
    binary = atob(text);
  } catch (error) {
    throw new Error(`題庫分段 ${index + 1} 無法解碼：${error?.message || error}`);
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function joinBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

async function loadPayload(context) {
  // 每個 payload2/*.txt 都是可獨立解碼的 Base64 區塊；
  // 區塊末端可能含有 padding，因此不可先直接串接文字再呼叫 atob()。
  const texts = await Promise.all(PART_PATHS.map((path) => readAsset(context, path)));
  const decodedParts = texts.map((text, index) => decodeBase64Part(text, index));
  const payload = joinBytes(decodedParts);

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
