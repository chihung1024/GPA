from pathlib import Path
import base64
import gzip
import hashlib
import io
import json
import re
import traceback

import zstandard as zstd

OUT = Path("gzip_data")
OUT.mkdir(exist_ok=True)


def clean_base64(value: str) -> str:
    value = re.sub(r"\s+", "", value).replace("-", "+").replace("_", "/")
    value = re.sub(r"[^A-Za-z0-9+/=]", "", value).replace("=", "")
    if len(value) % 4 == 1:
        raise ValueError(f"invalid Base64 length: {len(value)}")
    return value + "=" * ((4 - len(value) % 4) % 4)


def decompress_zstd(data: bytes) -> bytes:
    dctx = zstd.ZstdDecompressor()
    with dctx.stream_reader(io.BytesIO(data), read_across_frames=True) as reader:
        return reader.read()


def main() -> None:
    report = {"status": "error"}
    try:
        files = sorted(Path("payload").glob("*.txt"), key=lambda p: int(p.stem))
        if not files:
            raise FileNotFoundError("payload/*.txt not found")

        raw_parts = [p.read_text(encoding="utf-8") for p in files]
        report["input_files"] = [
            {"name": p.name, "chars": len(value), "sha256": hashlib.sha256(value.encode()).hexdigest()}
            for p, value in zip(files, raw_parts)
        ]

        attempts = []

        # Normal case: files are slices of one Base64 string.
        try:
            packed = base64.b64decode(clean_base64("".join(raw_parts)), validate=True)
            attempts.append(("joined_base64", packed))
        except Exception as error:
            report["joined_decode_error"] = repr(error)

        # Alternate case: each file is an independently padded Base64 block.
        try:
            packed = b"".join(
                base64.b64decode(clean_base64(value), validate=True) for value in raw_parts
            )
            attempts.append(("per_file_base64", packed))
        except Exception as error:
            report["per_file_decode_error"] = repr(error)

        html = None
        errors = []
        for mode, packed in attempts:
            try:
                candidate = decompress_zstd(packed)
                if b"<!doctype html>" not in candidate[:2000].lower():
                    raise ValueError("decoded content is not HTML")
                if b"QUESTION_BANK" not in candidate:
                    raise ValueError("QUESTION_BANK marker missing")
                html = candidate
                report["decode_mode"] = mode
                report["packed_bytes"] = len(packed)
                report["packed_magic"] = packed[:16].hex()
                break
            except Exception:
                errors.append({"mode": mode, "traceback": traceback.format_exc()})

        if html is None:
            report["decompression_errors"] = errors
            raise RuntimeError("all Zstandard decoding attempts failed")

        gz = gzip.compress(html, compresslevel=9, mtime=0)
        encoded = base64.b64encode(gz).decode("ascii")
        for old in OUT.glob("*.txt"):
            old.unlink()
        chunk_size = 700_000
        chunks = [encoded[i:i + chunk_size] for i in range(0, len(encoded), chunk_size)]
        for index, chunk in enumerate(chunks):
            (OUT / f"{index:03d}.txt").write_text(chunk, encoding="ascii")

        report.update({
            "status": "ok",
            "parts": len(chunks),
            "part_sizes": [len(chunk) for chunk in chunks],
            "base64_chars": len(encoded),
            "source_bytes": len(html),
            "source_sha256": hashlib.sha256(html).hexdigest(),
            "gzip_bytes": len(gz),
            "gzip_sha256": hashlib.sha256(gz).hexdigest(),
        })
    except Exception:
        report["traceback"] = traceback.format_exc()

    (OUT / "manifest.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
