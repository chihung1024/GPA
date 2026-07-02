function submitAnswer(value) {
  if (currentAnswered) return;
  currentAnswered = true;
  explanationExpanded = false;
  const isCorrect = value === currentQuestion.answer;
  stats.answered += 1;
  if (isCorrect) stats.correct += 1;

  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.value === currentQuestion.answer) btn.classList.add('correct');
    if (btn.dataset.value === value && !isCorrect) btn.classList.add('wrong');
  });

  const correctText = currentQuestion.type === 'mc'
    ? `(${currentQuestion.answer}) ${currentQuestion.options[Number(currentQuestion.answer) - 1]}`
    : `${currentQuestion.answer}（${currentQuestion.answer === 'O' ? '正確' : '錯誤'}）`;
  const quick = buildQuickExplanation(currentQuestion);
  const basisText = quick.refs.length
    ? quick.refs.map(ref => `${ref.law || ''}${ref.article || ''}`).filter(Boolean).join('；')
    : (currentQuestion.legalBasis || '');

  const feedback = $('feedback');
  feedback.className = `feedback ${isCorrect ? 'correct' : 'wrong'}`;
  feedback.innerHTML = `<div class="feedback-brief"><strong>${isCorrect ? '答對' : '答錯'}</strong><div class="feedback-answer">正確答案：${escapeHtml(correctText)}</div></div>
    <details id="feedbackDetails" class="explain-panel">
      <summary>展開精簡解題</summary>
      <div class="explain-panel-body"><div class="quick-solution">
        <section class="quick-block quick-rule"><h4>核心判斷</h4><p>${escapeHtml(quick.rule || correctText)}</p></section>
        ${quick.reason ? `<section class="quick-block quick-reason"><h4>為什麼</h4><p>${escapeHtml(quick.reason)}</p></section>` : ''}
        <section class="quick-block"><h4>逐選項速解</h4><ul class="quick-choice-list">${quick.choices.map(choice => `<li class="quick-choice-item ${choice.correct ? 'is-answer' : ''}"><span class="quick-choice-label">${escapeHtml(choice.label)}</span><span class="quick-choice-text"><b>${choice.correct ? '對：' : '錯：'}</b>${escapeHtml(choice.note)}</span></li>`).join('')}</ul></section>
        ${basisText ? `<div class="quick-basis">法規依據：${escapeHtml(basisText)}</div>` : ''}
        ${renderLegalRefs(quick.refs)}
      </div></div>
    </details>`;

  $('feedbackDetails')?.addEventListener('toggle', () => {
    explanationExpanded = !!$('feedbackDetails')?.open;
    syncExplainToggle();
  });
  $('nextBtn').disabled = false;
  syncExplainToggle();
  updateStats();
  $('nextBtn').focus({ preventScroll: true });
}
