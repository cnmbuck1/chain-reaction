/**
 * A gear outline centered on (c, c): `teeth` square-ish teeth reaching out to radius
 * `outer` from a rim at `inner`, with a round hole of radius `hole` (drawn even-odd).
 */
export function gearPath(teeth: number, outer: number, inner: number, hole: number, c = outer) {
  const at = (angle: number, r: number) =>
    `${(c + r * Math.cos(angle)).toFixed(2)} ${(c + r * Math.sin(angle)).toFixed(2)}`;
  const tip = (Math.PI / teeth) * 0.5;
  const root = (Math.PI / teeth) * 0.78;
  const points: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = (2 * Math.PI * i) / teeth;
    points.push(at(a - root, inner), at(a - tip, outer), at(a + tip, outer), at(a + root, inner));
  }
  return (
    `M${points.join(' L')}Z ` +
    `M${c + hole} ${c}a${hole} ${hole} 0 1 0 ${-2 * hole} 0 ${hole} ${hole} 0 0 0 ${2 * hole} 0z`
  );
}

const SETTINGS_GEAR = gearPath(8, 11, 8.4, 3.6, 12);

/** A cog: the usual mark for settings. */
export function GearIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d={SETTINGS_GEAR} />
    </svg>
  );
}
