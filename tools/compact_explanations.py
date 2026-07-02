from pathlib import Path

root = Path(__file__).resolve().parents[1]
index_path = root / "index.html"
html = index_path.read_text(encoding="utf-8")

style = (root / "tools" / "quick_style.css").read_text(encoding="utf-8").strip()
helpers = "\n\n".join(
    (root / "tools" / name).read_text(encoding="utf-8").strip()
    for name in ("quick_core.js", "quick_refs.js", "quick_notes.js")
)
submit = (root / "tools" / "quick_submit.js").read_text(encoding="utf-8").strip()

if ".quick-solution{" not in html:
    html = html.replace("</style>", f"\n{style}\n</style>", 1)

if "function quickNorm(" not in html:
    marker = "function currentSelection() {"
    if marker not in html:
        raise SystemExit("Could not locate helper insertion point")
    html = html.replace(marker, f"{helpers}\n\n{marker}", 1)

start = html.find("function submitAnswer(value) {")
end = html.find("\nfunction syncExplainToggle()", start)
if start < 0 or end < 0:
    raise SystemExit("Could not locate submitAnswer")
html = html[:start] + submit + "\n" + html[end:]

html = html.replace(">看解析</button>", ">看解題</button>")
html = html.replace(
    "(expanded ? '收合解析' : '看解析') : '看解析'",
    "(expanded ? '收合解題' : '看解題') : '看解題'",
)
html = html.replace(
    "解析預設縮起；需要時再按「看解析」",
    "解題預設縮起；需要時再按「看解題」",
)

required = (
    "function buildQuickExplanation(q)",
    "展開精簡解題",
    "逐選項速解",
    ".quick-choice-item.is-answer",
)
missing = [item for item in required if item not in html]
if missing:
    raise SystemExit(f"Patch validation failed: {missing}")

index_path.write_text(html, encoding="utf-8")
print(f"Updated {index_path} ({index_path.stat().st_size} bytes)")
