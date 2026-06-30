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

async function loadPayload(context) {
  // payload2/0.txt～4.txt 是同一個 Brotli 壓縮檔的 Base64 連續分段。
  // 不再套用另一版壓縮檔的固定長度及檔頭，避免誤判後回傳 HTTP 500。
  const parts = await Promise.all(PART_PATHS.map((path) => readAsset(context, path)));
  const base64 = parts.map((part) => part.trim()).join("");
  const binary = atob(base64);

  if (!binary.length) {
    throw new Error("題庫壓縮資料為空");
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
