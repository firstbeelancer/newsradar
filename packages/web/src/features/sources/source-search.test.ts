import { describe, expect, it } from 'vitest';
import type { Source } from '@shared/api/client';
import { matchesSourceSearch } from './source-search';

const source = {
  id: 'source-1',
  agent_id: 'agent-1',
  name: 'OpenNET RSS',
  url: 'https://opennet.ru/opennews/opennews_all.rss',
  type: 'rss',
  is_active: true,
  fetch_count: 10,
  created_at: '2026-08-02T00:00:00Z',
  updated_at: '2026-08-02T00:00:00Z',
  agents: [{ id: 'agent-1', name: 'Free DevOps & Инжиниринг' }],
} satisfies Source;

describe('source search', () => {
  it('finds sources by name, URL and assigned agent', () => {
    expect(matchesSourceSearch(source, 'opennet')).toBe(true);
    expect(matchesSourceSearch(source, 'opennews_all')).toBe(true);
    expect(matchesSourceSearch(source, 'инжиниринг')).toBe(true);
  });

  it('keeps every source visible for an empty query', () => {
    expect(matchesSourceSearch(source, '   ')).toBe(true);
  });
});
