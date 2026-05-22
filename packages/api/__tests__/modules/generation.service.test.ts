import { describe, expect, it } from 'vitest';
import { getGenerationCutoffDate, renderPromptTemplate } from '../../src/modules/generation/template-utils.js';

describe('generation service helpers', () => {
  it('рендерит шаблон с {{content}} и циклом по articles без сырого шаблонного синтаксиса', () => {
    const rendered = renderPromptTemplate(
      [
        'Дайджест:',
        '{% for article in articles %}',
        '- {{article.title}} :: {{article.description}}',
        '{% endfor %}',
        '',
        'Блок content:',
        '{{content}}',
      ].join('\n'),
      [
        {
          id: 'article-1',
          title: 'Google скрывала уязвимость',
          description: 'Подробности по багу',
          content: 'Текст статьи',
          aiSummary: null,
          link: 'https://example.com/google',
        },
      ] as never
    );

    expect(rendered).toContain('Google скрывала уязвимость');
    expect(rendered).toContain('Подробности по багу');
    expect(rendered).not.toContain('{%');
    expect(rendered).not.toContain('{{');
  });

  it('возвращает адекватную отсечку по периоду для дайджеста', () => {
    const now = Date.now();
    const dayCutoff = getGenerationCutoffDate('day').getTime();
    const weekCutoff = getGenerationCutoffDate('week').getTime();

    expect(now - dayCutoff).toBeGreaterThan(20 * 60 * 60 * 1000);
    expect(now - dayCutoff).toBeLessThan(28 * 60 * 60 * 1000);
    expect(now - weekCutoff).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
  });
});
