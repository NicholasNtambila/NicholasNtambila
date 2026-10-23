import { describe, expect, it } from 'vitest';

import { designTokens } from '../packages/shared/src';

describe('shared design tokens', () => {
  it('defines stable semantic colors and positive spacing values', () => {
    expect(designTokens.color.positive).toBe('#16803C');
    expect(designTokens.color.negative).toBe('#B42318');
    expect(
      Object.values(designTokens.spacing).every((value) => value > 0),
    ).toBe(true);
  });
});
