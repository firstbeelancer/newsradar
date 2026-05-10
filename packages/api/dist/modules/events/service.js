import Redis from "ioredis";
import { env } from "../../config/env.js";
const SSE_CHANNEL = "newsradar:operations";
let publisher = null;
let subscriber = null;
function getPublisher() {
    if (!publisher) {
        publisher = new Redis(env.REDIS_URL);
    }
    return publisher;
}
function getSubscriber() {
    if (!subscriber) {
        subscriber = new Redis(env.REDIS_URL);
    }
    return subscriber;
}
const clients = new Map();
export async function subscribeToOperations(workspaceId, res) {
    const list = clients.get(workspaceId) ?? [];
    list.push(res);
    clients.set(workspaceId, list);
    const sub = getSubscriber();
    await sub.subscribe(SSE_CHANNEL);
    sub.on("message", (_channel, message) => {
        try {
            const data = JSON.parse(message);
            const targetClients = clients.get(workspaceId) ?? [];
            for (const client of targetClients) {
                client.write(`data: ${JSON.stringify(data)}\n\n`);
            }
        }
        catch {
            // Ignore malformed messages
        }
    });
}
export function unsubscribeFromOperations(workspaceId, res) {
    const list = clients.get(workspaceId) ?? [];
    const filtered = list.filter((c) => c !== res);
    if (filtered.length === 0) {
        clients.delete(workspaceId);
    }
    else {
        clients.set(workspaceId, filtered);
    }
}
export async function publishOperationUpdate(payload) {
    const pub = getPublisher();
    await pub.publish(SSE_CHANNEL, JSON.stringify(payload));
}
export function getActiveSubscriberCount() {
    let count = 0;
    for (const list of clients.values()) {
        count += list.length;
    }
    return count;
}
//# sourceMappingURL=service.js.map