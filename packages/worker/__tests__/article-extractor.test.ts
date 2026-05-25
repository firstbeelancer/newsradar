import { describe, expect, it } from 'vitest';
import { extractArticleTextFromHtml } from '../src/lib/article-extractor.js';

describe('article extractor', () => {
  it('extracts article meta and paragraphs from linked HTML', () => {
    const html = `
      <html>
        <head>
          <meta property="og:description" content="Anthropic and OpenAI are embedding engineers into Wall Street teams to speed up AI adoption." />
        </head>
        <body>
          <article>
            <p>Large banks are bringing model-provider engineers directly into product and risk workflows so teams can turn prototypes into approved internal tools.</p>
            <p>The arrangement raises governance questions because vendors gain deep operational context while financial firms remain responsible for compliance.</p>
          </article>
        </body>
      </html>
    `;

    const text = extractArticleTextFromHtml(html);

    expect(text).toContain('embedding engineers');
    expect(text).toContain('governance questions');
    expect(text.length).toBeGreaterThan(180);
  });
});
