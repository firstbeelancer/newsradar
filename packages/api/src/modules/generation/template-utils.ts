interface PromptArticle {
  title: string;
  description?: string | null;
  aiSummary?: string | null;
  content?: string | null;
  link?: string | null;
}

export function buildArticleContent(articlesForPrompt: PromptArticle[]): string {
  return articlesForPrompt
    .map((article, index) => {
      const parts = [
        `Статья ${index + 1}: ${article.title}`,
        article.description ? `Описание: ${article.description}` : null,
        article.aiSummary ? `AI summary: ${article.aiSummary}` : null,
        article.content ? `Контент: ${article.content}` : null,
        article.link ? `Ссылка: ${article.link}` : null,
      ].filter(Boolean);

      return parts.join('\n');
    })
    .join('\n\n---\n\n');
}

function resolveTemplatePath(context: Record<string, unknown>, rawPath: string): string {
  const normalizedPath = rawPath
    .trim()
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

  let current: unknown = context;
  for (const segment of normalizedPath) {
    if (current == null) return '';

    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
      continue;
    }

    if (typeof current === 'object' && segment in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    return '';
  }

  if (current == null) return '';
  if (typeof current === 'string') return current;
  if (typeof current === 'number' || typeof current === 'boolean') return String(current);
  return '';
}

export function renderPromptTemplate(
  templatePrompt: string | null | undefined,
  selectedArticles: PromptArticle[]
): string {
  const content = buildArticleContent(selectedArticles);
  const prompt = templatePrompt?.trim() || '{{content}}';
  const context: Record<string, unknown> = {
    content,
    articles: selectedArticles.map((article) => ({
      title: article.title,
      description: article.description ?? '',
      content: article.content ?? article.aiSummary ?? '',
      link: article.link ?? '',
    })),
  };

  const withLoopsRendered = prompt.replace(
    /{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%}([\s\S]*?){%\s*endfor\s*%}/g,
    (_match, itemName: string, listName: string, body: string) => {
      const collection = context[listName];
      if (!Array.isArray(collection) || collection.length === 0) return '';

      return collection
        .map((item) =>
          body.replace(/{{\s*([^}]+)\s*}}/g, (_token, expression: string) =>
            resolveTemplatePath(
              {
                ...context,
                [itemName]: item,
              },
              expression
            )
          )
        )
        .join('');
    }
  );

  const withVariablesRendered = withLoopsRendered.replace(/{{\s*([^}]+)\s*}}/g, (_match, expression: string) =>
    resolveTemplatePath(context, expression)
  );

  return withVariablesRendered.replace(/{%[\s\S]*?%}/g, '').trim();
}

export function getGenerationCutoffDate(period: 'day' | 'week' | 'month' = 'day'): Date {
  const now = new Date();
  const cutoff = new Date(now);

  if (period === 'day') cutoff.setDate(now.getDate() - 1);
  if (period === 'week') cutoff.setDate(now.getDate() - 7);
  if (period === 'month') cutoff.setMonth(now.getMonth() - 1);

  return cutoff;
}
