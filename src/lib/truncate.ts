export function truncate(s: string, max: number): string {
  if (!s) return s;
  // Treat each character (including CJK) as 1 unit per the user's spec ("最长 20 个字").
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  return chars.slice(0, max).join('') + '…';
}
