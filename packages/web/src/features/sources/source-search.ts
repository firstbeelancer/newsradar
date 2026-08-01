import type { Source } from '@shared/api/client';

export function matchesSourceSearch(source: Source, rawQuery: string): boolean {
  const query = rawQuery.trim().toLocaleLowerCase('ru-RU');
  if (!query) return true;

  return [
    source.name,
    source.url,
    source.type,
    ...source.agents.map((agent) => agent.name),
  ].some((value) => value.toLocaleLowerCase('ru-RU').includes(query));
}
