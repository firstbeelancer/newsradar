// Updated triggerCollection to use BullMQ

export async function triggerCollection(agentId: string, workspaceId: string, userId: string) {
  // ... existing code ...
  // Add BullMQ job here
  await queue.add('fetch-source', { agentId, workspaceId, userId });
}