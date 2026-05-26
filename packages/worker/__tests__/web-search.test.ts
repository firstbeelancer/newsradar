import { afterEach, describe, expect, it, vi } from 'vitest';
import { runWebSearch, type WebSearchSettings } from '../src/lib/web-search.js';

describe('DeepSearch web search provider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses Brave Search API with an encrypted user key already decrypted by caller', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              title: 'OpenAI and Anthropic on Wall Street',
              url: 'https://example.com/story',
              description: 'AI labs are embedding engineers inside banks.',
              extra_snippets: ['Banks are using AI engineers in trading and compliance workflows.'],
            },
          ],
        },
      }),
    });

    const settings: WebSearchSettings = {
      provider: 'brave',
      apiKey: 'brave-secret',
      maxResults: 3,
    };

    const results = await runWebSearch('AI engineers Wall Street', settings, fetchMock as never);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://api.search.brave.com/res/v1/web/search?'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Subscription-Token': 'brave-secret',
        }),
      })
    );
    expect(results).toEqual([
      expect.objectContaining({
        title: 'OpenAI and Anthropic on Wall Street',
        url: 'https://example.com/story',
        snippet: expect.stringContaining('AI labs are embedding engineers'),
      }),
    ]);
  });

  it('returns no external sources when web search is disabled or has no key', async () => {
    const fetchMock = vi.fn();

    await expect(runWebSearch('query', { provider: 'disabled', maxResults: 5 }, fetchMock as never)).resolves.toEqual([]);
    await expect(runWebSearch('query', { provider: 'brave', maxResults: 5 }, fetchMock as never)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
