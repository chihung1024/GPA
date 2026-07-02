function quickWrongNote(q, optionIndex, rule) {
  const source = quickNorm(q.type === 'tf' ? q.stem : quickOptions(q)[optionIndex]);
  if (/自行判斷|自行認定/.test(source)) {
    const basis = source.replace(/^(依|視|按)/, '').replace(/(自行判斷|自行認定)[。．]?$/, '').replace(/^[，、\s]+|[，、\s]+$/g, '');
    return basis ? `不能只憑「${basis}」自行認定，必須符合明文法定要件。` : '不能自行認定，必須符合明文法定要件。';
  }
  if (/(報經|報請).+核准/.test(source)) return '核准程序不是本題的法定判斷標準。';
  if (source.includes('以上皆非')) return '已有選項符合規定，因此不能選「以上皆非」。';
  if (/以上皆是|以上皆正確/.test(source)) return '並非全部選項都成立。';

  const sourceNumbers = source.match(/\d+(?:\.\d+)?(?:%|％|萬元|億元|日|年|家|次)?/g) || [];
  const ruleNumbers = rule.match(/\d+(?:\.\d+)?(?:%|％|萬元|億元|日|年|家|次)?/g) || [];
  if (sourceNumbers.length && ruleNumbers.length && sourceNumbers.join('|') !== ruleNumbers.join('|')) {
    return `數字或門檻不符；正確為「${quickShorten(rule, 70)}」`;
  }

  const analysis = q.choiceAnalyses?.[optionIndex] || {};
  const why = quickNorm(analysis.why);
  const quoted = why.match(/選項寫的是「(.+?)」，正確規則是「(.+?)」/);
  if (quoted && quoted[1].length <= 70) return `「${quoted[1]}」不是本題適用的法定規則。`;

  const error = quickNorm(analysis.error).split(/。實務上|；實務上|。除非|；除非/)[0];
  if (error && error.length <= 90 && !/適用條件、程序階段|權責主體是「其他主體」|責任主體、成立要件|本題為錯誤|這句話不正確/.test(error)) {
    return error.endsWith('。') ? error : `${error}。`;
  }
  for (const absolute of ['一律', '僅', '全部', '任何情形', '無須', '只能']) {
    if (source.includes(absolute)) return `「${absolute}」把規則說得過度絕對，忽略法定條件或例外。`;
  }
  return '此敘述不符合上述法定規則。';
}

function buildQuickExplanation(q) {
  const index = quickAnswerIndex(q);
  const rule = quickRule(q);
  const refs = quickLegalRefs(q);
  return {
    rule: quickShorten(rule, 220),
    reason: refs.length ? quickShorten(refs[0].text, 190) : '',
    refs,
    choices: quickOptions(q).map((_, optionIndex) => ({
      label: q.type === 'mc' ? String(optionIndex + 1) : (optionIndex === 0 ? 'O' : 'X'),
      correct: optionIndex === index,
      note: optionIndex === index ? '符合上述法定規則。' : quickWrongNote(q, optionIndex, rule)
    }))
  };
}
