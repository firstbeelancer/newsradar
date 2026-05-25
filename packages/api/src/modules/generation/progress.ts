import { getRedisConnection, getRedisSubscriber } from "../../lib/redis.js";

export type GenerationStatus = "pending" | "generating" | "completed" | "error";

export interface GenerationState {
  status: GenerationStatus;
  content: string;
  chunks: string[];
  error?: string;
  timestamp?: number;
}

const stateTtlSeconds = 60 * 60;

export function generationStateKey(operationId: string): string {
  return `newsradar:generation:state:${operationId}`;
}

export function generationChannel(operationId: string): string {
  return `newsradar:generation:${operationId}`;
}

export async function setGenerationState(operationId: string, state: GenerationState): Promise<void> {
  const redis = getRedisConnection();
  await redis.set(
    generationStateKey(operationId),
    JSON.stringify({ ...state, timestamp: state.timestamp ?? Date.now() }),
    "EX",
    stateTtlSeconds
  );
}

export async function getGenerationState(operationId: string): Promise<GenerationState | undefined> {
  const raw = await getRedisConnection().get(generationStateKey(operationId));
  if (!raw) return undefined;

  try {
    return JSON.parse(raw) as GenerationState;
  } catch {
    return undefined;
  }
}

export async function subscribeGenerationState(
  operationId: string,
  onState: (state: GenerationState) => void
): Promise<() => Promise<void>> {
  const subscriber = getRedisSubscriber();
  const channel = generationChannel(operationId);

  subscriber.on("message", (receivedChannel: string, message: string) => {
    if (receivedChannel !== channel) return;
    try {
      onState(JSON.parse(message) as GenerationState);
    } catch {
      onState({ status: "error", content: "", chunks: [], error: "Invalid generation event" });
    }
  });

  await subscriber.subscribe(channel);

  return async () => {
    await subscriber.unsubscribe(channel);
    subscriber.disconnect();
  };
}
