import { describe, expect, it } from 'vitest';
import { formatDuration, formatMoney, youtubeEmbed } from './format.js';

describe('format helpers', () => {
  it('formats paise as rupees with Indian digit grouping', () => {
    expect(formatMoney(15000)).toBe('₹150');
    expect(formatMoney(40120)).toBe('₹401.20');
    expect(formatMoney(12345600)).toBe('₹1,23,456');
    expect(formatMoney(undefined)).toBe('₹0');
  });
  it('formats durations', () => {
    expect(formatDuration(128)).toBe('2h 08m');
    expect(formatDuration(60)).toBe('1h 00m');
  });
  it('only embeds real YouTube links', () => {
    expect(youtubeEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain('/embed/dQw4w9WgXcQ');
    expect(youtubeEmbed('https://youtu.be/dQw4w9WgXcQ')).toContain('/embed/dQw4w9WgXcQ');
    expect(youtubeEmbed('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youtubeEmbed('')).toBeNull();
  });
});
