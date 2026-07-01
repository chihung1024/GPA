from pathlib import Path
import base64, json, re
import brotli
import zstandard as zstd


def payload(folder):
    files = sorted(Path(folder).glob('*.txt'))
    if not files:
        raise SystemExit(f'no files in {folder}')
    text = ''.join(p.read_text(encoding='utf-8') for p in files)
    text = re.sub(r'[^A-Za-z0-9+/=]', '', text).rstrip('=')
    text += '=' * ((4 - len(text) % 4) % 4)
    return base64.b64decode(text)


ui = brotli.decompress(payload('payload2'))
if b'fetch("data.json"' not in ui:
    raise SystemExit('invalid compact UI')
Path('index.html').write_bytes(ui)

full = zstd.ZstdDecompressor().decompress(
    payload('payload'), max_output_size=100_000_000
).decode('utf-8')
match = re.search(r'const QUESTION_BANK = (\[.*?\]);\s*const CHAPTER_STATS', full, re.S)
if not match:
    raise SystemExit('question bank not found')
source = json.loads(match.group(1))

chapters = []
chapter_ids = {}
notes = []
note_ids = {}
refs = []
ref_ids = {}
refsets = []
refset_ids = {}
questions = []


def note_id(text):
    text = text or ''
    if text not in note_ids:
        note_ids[text] = len(notes)
        notes.append(text)
    return note_ids[text]


def ref_id(item):
    key = (item.get('law', ''), item.get('article', ''), item.get('url', ''))
    if key not in ref_ids:
        ref_ids[key] = len(refs)
        refs.append({'law': key[0], 'article': key[1], 'url': key[2]})
    return ref_ids[key]


def refset_id(items):
    key = tuple(ref_id(item) for item in items)
    if key not in refset_ids:
        refset_ids[key] = len(refsets)
        refsets.append(list(key))
    return refset_ids[key]


for question in source:
    chapter = question['chapter']
    if chapter not in chapter_ids:
        chapter_ids[chapter] = len(chapters)
        chapters.append(chapter)
    analyses = question.get('choiceAnalyses') or []
    if question['type'] == 'mc':
        note_indexes = []
        refset_indexes = []
        option_notes = question.get('optionNotes') or []
        for index, _ in enumerate(question.get('options') or []):
            analysis = analyses[index] if index < len(analyses) else {}
            text = analysis.get('why') or (option_notes[index] if index < len(option_notes) else '')
            note_indexes.append(note_id(text))
            refset_indexes.append(refset_id(analysis.get('legalRefs') or []))
        questions.append([
            chapter_ids[chapter], 1, question['number'], question['answer'],
            question['stem'], question.get('options') or [], note_indexes, refset_indexes
        ])
    else:
        refset_indexes = [
            refset_id((analyses[index] if index < len(analyses) else {}).get('legalRefs') or [])
            for index in range(2)
        ]
        questions.append([
            chapter_ids[chapter], 0, question['number'], question['answer'],
            question['stem'], [], [], refset_indexes
        ])

if len(questions) != 3599:
    raise SystemExit(f'wrong question count: {len(questions)}')

data = {'c': chapters, 'q': questions, 'd': {'note': notes, 'ref': refs, 'refset': refsets}}
Path('data.json').write_text(
    json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8'
)
Path('_headers').write_text(
    '/index.html\n  Cache-Control: no-cache, no-store, must-revalidate\n'
    '/data.json\n  Cache-Control: public, max-age=3600\n',
    encoding='utf-8',
)
print(f'questions={len(questions)} data_bytes={Path("data.json").stat().st_size}')
