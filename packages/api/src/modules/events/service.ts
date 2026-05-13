import type { Response } from "express";
import Redis from "ioredis";
import { env } from "../../config/env.js";

const SSE_CHANNEL = "newsradar:operations";

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(env.REDIS_URL);
  }
  return publisher;
}

function getSubscriber(): Redis {
  if (!subscriber) {
    subscriber = new Redis(env.REDIS_URL);
  }
  return subscriber;
}

const clients = new Map<string, Response[]>();

export async function subscribeToOperations(workspaceId: string, res: Response): Promise<void> {
  const list = clients.get(workspaceId) ?? [];
  list.push(res);
  clients.set(workspaceId, list);

  const sub = getSubscriber();
  await sub.subscribe(SSE_CHANNEL);

  sub.on("message", (_channel, message) => {
    try {
      const data = JSON.parse(message) as { workspaceId?: string };
      const targetClients = clients.get(workspaceId) ?? [];
      for (const client of targetClients) {
        client.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    } catch {
      // Ignore malformed messages
    }
  });
}

export function unsubscribeFromOperations(workspaceId: string, res: Response): void {
  const list = clients.get(workspaceId) ?? [];
  const filtered = list.filter((c) => c !== res);
  if (filtered.length === 0) {
    clients.delete(workspaceId);
  } else {
    clients.set(workspaceId, filtered);
  }
}

export async function publishOperationUpdate(payload: {
  workspaceId: string;
  operationId: string;
  status: string;
  message?: string;
}): Promise<void> {
  const pub = getPublisher();
  await pub.publish(SSE_CHANNEL, JSON.stringify(payload));
}

export function getActiveSubscriberCount(): number {
  let count = 0;
  for (const list of clients.values()) {
    count += list.length;
  }
  return count;
}
