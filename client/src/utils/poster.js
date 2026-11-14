// Deterministic "poster" colours so movies without artwork still look intentional.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function posterGradient(title = '') {
  const h = hash(title);
  const a = h % 360;
  const b = (a + 40 + (h % 70)) % 360;
  return `linear-gradient(155deg, hsl(${a} 62% 34%) 0%, hsl(${b} 58% 16%) 62%, hsl(${(b + 20) % 360} 40% 9%) 100%)`;
}
