function quickNorm(value) {
  return String(value ?? '').replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
}

function quickAnswerIndex(q) {
  return q.type === 'mc' ? Number(q.answer) - 1 : (q.answer === 'O' ? 0 : 1);
}

function quickOptions(q) {
  return q.type === 'mc' ? q.options : ['正確', '錯誤'];
}

function quickRule(q) {
  const index = quickAnswerIndex(q);
  const analyses = Array.isArray(q.choiceAnalyses) ? q.choiceAnalyses : [];
  const candidates = [q.canonicalRule, analyses[index]?.correctRule, quickOptions(q)[index]];
  return quickNorm(candidates.find(text => {
    const value = quickNorm(text);
    return value && !/本題逐一核對|採購程序重視|請展開下方|依題庫答案判定/.test(value);
  }) || quickOptions(q)[index]);
}

function quickShorten(value, limit = 190) {
  const text = quickNorm(value);
  if (text.length <= limit) return text;
  const sentences = text.match(/.*?[。；]|.+$/g) || [];
  let result = '';
  for (const sentence of sentences) {
    if ((result + sentence).length > limit) break;
    result += sentence;
  }
  return result || `${text.slice(0, limit - 1).replace(/[，；：\s]+$/, '')}…`;
}

function quickTerms(value) {
  const text = quickNorm(value);
  const terms = new Set();
  for (const match of text.matchAll(/第\s*\d+(?:-\d+)?條(?:之\d+)?/g)) terms.add(match[0]);
  for (const match of text.matchAll(/\d+(?:\.\d+)?(?:%|％|萬元|億元|日|年|家|次)?/g)) terms.add(match[0]);
  for (const match of text.matchAll(/「([^」]{2,25})」/g)) terms.add(match[1]);
  for (const match of text.matchAll(/[\u4e00-\u9fff]{3,12}/g)) {
    const chunk = match[0];
    terms.add(chunk);
    for (const size of [2, 3, 4]) {
      for (let start = 0; start <= chunk.length - size; start += 1) terms.add(chunk.slice(start, start + size));
    }
  }
  return terms;
}
