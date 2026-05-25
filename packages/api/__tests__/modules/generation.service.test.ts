import { describe, expect, it } from 'vitest';
import { buildCompactArticleContext, getGenerationCutoffDate, renderPromptTemplate, sanitizeTelegramText } from '../../src/modules/generation/template-utils.js';

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
  it('keeps hashtags only when regeneration feedback explicitly asks for tags', () => {
    expect(sanitizeTelegramText('Финал #ai #news')).toBe('Финал ai news');
    expect(sanitizeTelegramText('Финал #ai #news', { allowHashtags: true })).toBe('Финал #ai #news');
  });

  it('keeps original links in compact regeneration context without full article bloat', () => {
    const context = buildCompactArticleContext([
      {
        title: 'AI agents on Wall Street',
        aiSummary: 'Banks are embedding AI engineers into workflows.',
        content: 'x'.repeat(2000),
        link: 'https://example.com/original',
      },
    ]);

    expect(context).toContain('https://example.com/original');
    expect(context).toContain('Banks are embedding AI engineers');
    expect(context.length).toBeLessThan(1000);
  });
});
