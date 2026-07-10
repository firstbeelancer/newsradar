export type CollectionSourceRef = {
  id: string;
  name: string;
};

export function deduplicateCollectionSources(
  sources: CollectionSourceRef[]
): CollectionSourceRef[] {
  return Array.from(new Map(sources.map((source) => [source.id, source])).values());
}
