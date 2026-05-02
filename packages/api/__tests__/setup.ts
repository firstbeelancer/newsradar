import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Pool } from 'pg';
import Redis from 'ioredis';

// ── Моки внешних зависимостей ──────────────────────────────────────────────────

vi.mock('pg', () => {
  const mPool = {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  return { Pool: vi.fn(() => mPool), default: { Pool: vi.fn(() => mPool) } };
});

vi.mock('ioredis', () => {
  const mRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    expire: vi.fn(),
    pipeline: vi.fn(() => ({ exec: vi.fn() })),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    publish: vi.fn(),
    on: vi.fn(),
    quit: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    hset: vi.fn(),
    hget: vi.fn(),
    hgetall: vi.fn(),
    incr: vi.fn(),
    decr: vi.fn(),
    exists: vi.fn(),
  };
  return { default: vi.fn(() => mRedis) };
});

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getJob: vi.fn(),
    close: vi.fn(),
  })),
  Worker: vi.fn(),
  QueueEvents: vi.fn(),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

vi.mock('pino', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  })),
  pino: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

vi.mock('rss-parser', () => ({
  default: vi.fn().mockImplementation(() => ({
    parseURL: vi.fn(),
  })),
}));

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

vi.mock('cheerio', () => ({
  load: vi.fn(),
  default: {
    load: vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('$2b$10$hashed'),
  compare: vi.fn().mockResolvedValue(true),
}));

vi.mock('jsonwebtoken', () => ({
  sign: vi.fn().mockReturnValue('mock.jwt.token'),
  verify: vi.fn().mockReturnValue({ sub: 'mock-user-id', workspace_id: 'mock-ws-id' }),
  decode: vi.fn(),
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomBytes: vi.fn((size: number) => Buffer.alloc(size, 0xff)),
  };
});

vi.mock('passport', () => ({
  default: {
    use: vi.fn(),
    initialize: vi.fn(() => (req: any, res: any, next: any) => next()),
    authenticate: vi.fn(() => (req: any, res: any, next: any) => next()),
    session: vi.fn(),
  },
}));

// ── Глобальные тестовые хелперы ────────────────────────────────────────────────

export const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
export const TEST_WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440002';
export const TEST_AGENT_ID = '550e8400-e29b-41d4-a716-446655440003';

export function createMockRequest(overrides: Record<string, any> = {}) {
  return {
    user: { sub: TEST_USER_ID, workspace_id: TEST_WORKSPACE_ID },
    params: {},
    query: {},
    body: {},
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  };
}

export function createMockResponse() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.send = vi.fn(() => res);
  res.cookie = vi.fn(() => res);
  res.clearCookie = vi.fn(() => res);
  res.header = vi.fn(() => res);
  res.setTimeout = vi.fn(() => res);
  return res;
}

export function createMockNext() {
  return vi.fn();
}

beforeEach(() => {
  vi.clearAllMocks();
});