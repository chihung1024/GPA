const PART_PATHS = Array.from({ length: 5 }, (_, i) => `/payload2/${i}.txt`);
const EXPECTED_LENGTH = 710068;
const EXPECTED_PREFIX = [0xcb, 0xff, 0xff, 0x3f, 0x15, 0xb2, 0xf3, 0xd1, 0x70, 0xdb, 0xa0, 0x99, 0x1b, 0x69, 0x40, 0xed];

let payloadPromise;

function cleanBase64(value) {
  return String(value)
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");
}

function decodeBase64(value) {
  let text = cleanBase64(value).replace(/=/g, "");
  if (text.length % 4 === 1) {
    throw new Error("Invalid Base64 payload length");
  }
  text += "=".repeat((4 - (text.length % 4)) % 4);

  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function joinBytes(chunks) {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function isExpectedPayload(bytes) {
  if (bytes.byteLength !== EXPECTED_LENGTH) return false;
  return EXPECTED_PREFIX.every((value, index) => bytes[index] === value);
}

async function loadPayload(context) {
  const texts = await Promise.all(
    PART_PATHS.map(async (path) => {
      const url = new URL(path, context.request.url);
      const response = await context.env.ASSETS.fetch(new Request(url, { method: "GET" }));
      if (!response.ok) {
        throw new Error(`${path}: HTTP ${response.status}`);
      }
      return response.text();
    }),
  );

  const candidates = [];

  try {
    candidates.push(decodeBase64(texts.join("")));
  } catch (error) {
    console.warn("Joined payload decoding failed", error);
  }

  try {
    candidates.push(joinBytes(texts.map(decodeBase64)));
  } catch (error) {
    console.warn("Per-part payload decoding failed", error);
  }

  const payload = candidates.find(isExpectedPayload);
  if (!payload) {
    throw new Error("Quiz payload validation failed");
  }
  return payload;
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
        "Content-Length": String(payload.byteLength),
        "Cache-Control": "public, max-age=300, s-maxage=86400",
        "Vary": "Accept-Encoding",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    payloadPromise = undefined;
    console.error(error);
    return new Response(
      `<!doctype html><meta charset="utf-8"><title>題庫載入失敗</title><style>body{font-family:system-ui,"Microsoft JhengHei",sans-serif;padding:2rem;color:#9f1d1d}</style><h1>題庫載入失敗</h1><p>${String(error?.message || error)}</p>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}
