import { describe, expect, it } from 'vitest';
import { AGENT_COLORS } from '../src/features/agents/agent-form';
import { getArticleAgentStyle } from '../src/features/feed/article-card';

describe('feed agent color accents', () => {
  it('uses an agent color as a stable card accent', () => {
    const style = getArticleAgentStyle('#ec4899');

    expect(style).toMatchObject({
      '--agent-color': '#ec4899',
      '--agent-color-soft': '#ec48991f',
      '--agent-color-line': '#ec48995c',
    });
  });

  it('does not add a fake accent when the article has no agent color', () => {
    expect(getArticleAgentStyle(undefined)).toBeUndefined();
    expect(getArticleAgentStyle('default')).toBeUndefined();
  });

  it('offers a broader palette for visually distinct agents', () => {
    expect(AGENT_COLORS.length).toBeGreaterThanOrEqual(24);
    expect(AGENT_COLORS).toContain('#84cc16');
    expect(AGENT_COLORS).toContain('#f43f5e');
  });
});
