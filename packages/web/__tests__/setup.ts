import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ── Mock Telegram WebApp ─────────────────────────────────────────────────────

const mockTelegramWebApp = {
  ready: vi.fn(),
  expand: vi.fn(),
  close: vi.fn(),
  enableClosingConfirmation: vi.fn(),
  openInvoice: vi.fn(),
  MainButton: {
    show: vi.fn(),
    hide: vi.fn(),
    setText: vi.fn(),
    onClick: vi.fn(),
    offClick: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  },
  BackButton: {
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn(),
  },
  initData: 'query_id=...&user=...&hash=...',
  initDataUnsafe: {
    user: { id: 12345, first_name: 'Test', username: 'testuser' },
    start_param: '',
  },
  colorScheme: 'light',
  themeParams: {
    bg_color: '#ffffff',
    text_color: '#000000',
    button_color: '#2481cc',
  },
  platform: 'ios',
  version: '8.0',
  onEvent: vi.fn(),
  offEvent: vi.fn(),
  sendData: vi.fn(),
};

Object.defineProperty(window, 'Telegram', {
  value: { WebApp: mockTelegramWebApp },
  writable: true,
});

// ── Mock IntersectionObserver ────────────────────────────────────────────────

window.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: vi.fn(),
}));

// ── Mock ResizeObserver ──────────────────────────────────────────────────────

window.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ── Mock Clipboard API ───────────────────────────────────────────────────────

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
});

// ── Mock matchMedia ──────────────────────────────────────────────────────────

window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));