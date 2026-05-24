import { describe, expect, it } from 'vitest';
import { buildExtractiveSummary, detectLanguage } from '../src/lib/translator.js';

describe('translator helpers', () => {
  it('detects English from title and body text', () => {
    expect(detectLanguage('I have become addicted to printing tattoos')).toBe('en');
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
});
