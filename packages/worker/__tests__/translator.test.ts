import { describe, expect, it } from 'vitest';
import { buildExtractiveSummary, buildTitleOnlyPreview, detectLanguage } from '../src/lib/translator.js';

describe('translator helpers', () => {
  it('detects English from title and body text', () => {
    expect(detectLanguage('I have become addicted to printing tattoos')).toBe('en');
  });

  it('detects Chinese titles that previously leaked into the feed untranslated', () => {
    expect(detectLanguage('Agent 越能干，安全越难做？')).toBe('zh');
    expect(detectLanguage('医疗与生命科学领导者必须回答的 10 个 Agentic AI 关键问题')).toBe('zh');
  });

  it('builds a multi-sentence summary instead of copying only the first sentence', () => {
    const text = [
      'Первое предложение короткое.',
      'Портативный принтер временных татуировок позволяет наносить изображения без салона и быстро менять дизайн.',
      'Главная причина интереса в том, что устройство превращает кастомные рисунки в персональный аксессуар для поездок и мероприятий.',
      'Покупателям важно учитывать расходники, стойкость рисунка и качество приложения перед покупкой.',
    ].join(' ');

    const summary = buildExtractiveSummary(text, 'портативный принтер татуировок', 260);

    expect(summary).toContain('принтер');
    expect(summary.split('.').filter(Boolean).length).toBeGreaterThan(1);
    expect(summary).not.toBe('Первое предложение короткое.');
  });
  it('builds a non-empty preview when RSS has only a title', () => {
    const preview = buildTitleOnlyPreview('Anthropic и OpenAI стремятся внедрить инженеров в рабочие процессы Уолл-стрит');

    expect(preview).toContain('Anthropic');
    expect(preview.length).toBeGreaterThan(40);
  });
});
