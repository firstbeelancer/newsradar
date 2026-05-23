import { describe, expect, it } from 'vitest';
import { generationApi, normalizeGeneratedPost } from '../src/shared/api/client';

describe('generated post history api contract', () => {
  it('keeps article ids and title from the generated post payload', () => {
    const post = normalizeGeneratedPost({
      id: 'post-1',
      title: 'Draft title',
      content: 'Generated content',
      type: 'manual',
      provider: 'openrouter',
      modelSnapshot: 'openrouter/auto',
      articlesSnapshot: [
        { id: 'article-1', title: 'Article 1' },
        { id: 'article-2', title: 'Article 2' },
      ],
      createdAt: '2026-05-23T10:00:00.000Z',
    } as never);

    expect(post.title).toBe('Draft title');
    expect(post.article_ids).toEqual(['article-1', 'article-2']);
    expect(post.type).toBe('post');
  });

  it('exposes open, update, and delete methods for generated posts', () => {
    expect(typeof generationApi.getPost).toBe('function');
    expect(typeof generationApi.updatePost).toBe('function');
    expect(typeof generationApi.deletePost).toBe('function');
  });
});
