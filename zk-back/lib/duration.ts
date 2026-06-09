const UNIT: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

export function toSeconds(duration: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(duration.trim());
  if (!match) throw new Error(`잘못된 duration 형식: ${duration}`);
  const [, value, unit] = match;
  return Number(value) * UNIT[unit];
}
