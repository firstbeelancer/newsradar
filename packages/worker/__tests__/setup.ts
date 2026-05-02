import { vi, beforeAll, afterAll, beforeEach } from 'vitest';

vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({ add: vi.fn(), close: vi.fn() })),
  Worker: vi.fn(),
  QueueEvents: vi.fn(),
}));

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    get: vi.fn(), set: vi.fn(), ping: vi.fn().mockResolvedValue('PONG'),
  })),
}));

vi.mock('pg', () => ({
  Pool: vi.fn(() => ({ query: vi.fn(), end: vi.fn() })),
}));

vi.mock('pino', () => ({
  default: vi.fn(() => ({
    info: vi.fn(), error: vi.fn(), warn: vi.fn(), child: vi.fn(() => ({ info: vi.fn(), error: vi.fn() })),
  })),
}));

vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: { completions: { create: vi.fn() } },
  })),
}));

vi.mock('rss-parser', () => ({
  default: vi.fn(() => ({ parseURL: vi.fn() })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});