import { describe, expect, it } from 'vitest';
import { deepsearchApi, normalizeDeepSearchResult } from '../src/shared/api/client';

describe('deepsearch history api contract', () => {
  it('normalizes report source findings for history rendering', () => {
    const result = normalizeDeepSearchResult({
      id: 'result-1',
      query: 'AI engineers on Wall Street',
      status: 'completed',
      reportText: 'Report body',
      findings: {
        articleId: 'article-1',
        articleTitle: 'Original article',
        externalSources: [
          { title: 'Second source', url: 'https://example.com/source', snippet: 'Context' },
        ],
      },
      createdAt: '2026-05-26T10:00:00.000Z',
    } as never);

    expect(result.report_text).toBe('Report body');
    expect(result.findings?.articleId).toBe('article-1');
    expect(result.findings?.externalSources).toHaveLength(1);
  });

  it('exposes list and delete methods for DeepSearch history', () => {
    expect(typeof deepsearchApi.list).toBe('function');
    expect(typeof deepsearchApi.delete).toBe('function');
  });

  it('normalizes backend error_message for failed DeepSearch rows', () => {
    const result = normalizeDeepSearchResult({
      id: 'result-failed',
      status: 'failed',
      error_message: 'DeepSearch timeout',
      created_at: '2026-05-28T16:31:34.000Z',
    } as never);

    expect(result.error).toBe('DeepSearch timeout');
  });
});
