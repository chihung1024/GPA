const PART_PATHS = Array.from({ length: 5 }, (_, i) => `/payload2/${i}.txt`);
const EXPECTED_LENGTH = 710068;
const EXPECTED_PREFIX = [0xcb, 0xff, 0xff, 0x3f, 0x15, 0xb2, 0xf3, 0xd1];

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
  // payload2/0.txt～4.txt 是同一條 Base64 字串的連續分段。
  // 僅解碼一次，避免在 Pages Functions 的 CPU 時限內重複做大型字串處理。
  const parts = await Promise.all(PART_PATHS.map((path) => readAsset(context, path)));
  const base64 = parts.join("").replace(/\s+/g, "");
  const binary = atob(base64);

  if (binary.length !== EXPECTED_LENGTH) {
    throw new Error(`題庫資料長度錯誤：${binary.length}`);
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  for (let i = 0; i < EXPECTED_PREFIX.length; i += 1) {
    if (bytes[i] !== EXPECTED_PREFIX[i]) {
      throw new Error("題庫資料驗證失敗");
    }
  }

  return bytes;
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
      `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>題庫載入失敗</title><style>body{font-family:system-ui,"Microsoft JhengHei",sans-serif;max-width:720px;margin:3rem auto;padding:0 1.25rem;color:#9f1d1d;line-height:1.7}code{word-break:break-all;background:#fff0f0;padding:.2rem .4rem}</style><h1>題庫載入失敗</h1><p>伺服器未能準備題庫資料。</p><p><code>${message.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}</code></p><p>請重新整理；若仍失敗，請提供本頁顯示的錯誤文字。</p></html>`,
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
