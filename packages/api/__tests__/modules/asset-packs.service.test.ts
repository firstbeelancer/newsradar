import { describe, expect, it } from 'vitest';
import { DEFAULT_EMOJI_ITEMS, normalizeEmojiValues } from '../../src/modules/asset-packs/defaults.js';

describe('asset pack helpers', () => {
  it('ships a practical default emoji set instead of only eight items', () => {
    expect(DEFAULT_EMOJI_ITEMS.length).toBeGreaterThanOrEqual(32);
  });

  it('normalizes pasted emoji text into a deduped pack list', () => {
    expect(normalizeEmojiValues('🔥 🚨\n🔥, ✅  📌')).toEqual(['🔥', '🚨', '✅', '📌']);
  });
});
