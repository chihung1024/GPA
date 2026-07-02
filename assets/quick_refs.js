function quickLegalRefs(q) {
  const index = quickAnswerIndex(q);
  const rule = quickRule(q);
  const stem = quickNorm(q.stem);
  const basis = quickNorm(q.legalBasis);
  const targetTerms = quickTerms(`${rule} ${stem} ${quickOptions(q)[index]}`);
  const seen = new Set();
  const ranked = [];
  (q.choiceAnalyses || []).forEach((analysis, analysisIndex) => {
    (analysis.legalRefs || []).forEach(source => {
      const ref = {
        law: quickNorm(source.law),
        article: quickNorm(source.article),
        text: quickNorm(source.text),
        url: String(source.url || '').trim()
      };
      const key = `${ref.law}|${ref.article}|${ref.text}`;
      if (!ref.text || seen.has(key)) return;
      seen.add(key);
      let score = 0;
      if (ref.article && rule.includes(ref.article)) score += 220;
      if (ref.article && stem.includes(ref.article)) score += 120;
      if (ref.law && basis.includes(ref.law)) score += 12;
      if (analysisIndex === index) score += 15;
      targetTerms.forEach(term => {
        if (term.length >= 2 && ref.text.includes(term)) score += Math.min(10, term.length * 1.2);
      });
      ranked.push({ score, ref });
    });
  });
  ranked.sort((a, b) => b.score - a.score);
  if (!ranked.length) return [];
  const top = ranked[0].score;
  const selected = [];
  for (const entry of ranked) {
    if (selected.length && entry.score < Math.max(85, top * .48)) continue;
    selected.push(entry.ref);
    if (selected.length === 2) break;
  }
  return selected;
}
