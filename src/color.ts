export type RGB = [number, number, number];
export type Color = { h: number; s: number; v: number };
export type HSL = { h: number; s: number; l: number };
export type Mode = 'Complementary' | 'Analogous' | 'Triadic' | 'Split-complementary' | 'Monochromatic';
export type Format = 'HEX' | 'RGB' | 'HSL';

export const hue = (h: number) => ((h % 360) + 360) % 360;
export const unit = (n: number) => Math.min(1, Math.max(0, n));
export const decimal = (n: number) => String(Math.round(n * 10) / 10);
export const displayHue = (n: number) => decimal(n) === '360' ? '0' : decimal(n);

function channels(h: number, chroma: number, offset: number): RGB {
  const sector = hue(h) / 60;
  const x = chroma * (1 - Math.abs(sector % 2 - 1));
  const sectors: RGB[] = [[chroma,x,0], [x,chroma,0], [0,chroma,x], [0,x,chroma], [x,0,chroma], [chroma,0,x]];
  return sectors[Math.floor(sector)].map(n => 255 * unit(n + offset)) as RGB;
}

export function fromRGB(rgb: RGB, previous: Color): Color {
  const [r,g,b] = rgb.map(n => n / 255);
  const v = Math.max(r,g,b);
  const d = v - Math.min(r,g,b);
  const sector = v === r ? (g-b)/d : v === g ? (b-r)/d + 2 : (r-g)/d + 4;
  return { h: d ? hue(60 * sector) : previous.h, s: v ? d/v : previous.s, v };
}

export function fromHSL({ h, s, l }: HSL): Color {
  const chroma = (1 - Math.abs(2*l - 1)) * s;
  const v = unit(l + chroma/2);
  return { h: hue(h), s: v && l < 1 ? unit(chroma/v) : 0, v };
}

export function toHSL({h,s,v}: Color): HSL {
  const chroma = v*s;
  const l = v - chroma/2;
  return { h, s: chroma && l > 0 && l < 1 ? unit(chroma / (1 - Math.abs(2*l-1))) : 0, l };
}

export function toRGB({h,s,v}: Color): RGB {
  return channels(h, v*s, v*(1-s)).map(Math.round) as RGB;
}

export function parseHex(input: string): RGB | null {
  const value = input.trim().replace(/^#/, '');
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) return null;
  const full = value.length === 3 ? value.replace(/./g, c => c + c) : value;
  return [0,2,4].map(i => parseInt(full.slice(i,i+2), 16)) as RGB;
}

export function parseChannels(values: string[], group: 'rgb' | 'hsl'): number[] {
  const pattern = group === 'rgb' ? /^\d+$/ : /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
  return values.map((value, i) => {
    const n = Number(value.trim());
    if (!pattern.test(value.trim()) || !Number.isFinite(n)) return NaN;
    if (group === 'hsl' && i === 0) return n;
    return n >= 0 && n <= (group === 'rgb' ? 255 : 100) ? n : NaN;
  });
}

export function formatColor(color: Color, format: Format): string {
  const rgb = toRGB(color);
  if (format === 'RGB') return 'rgb(' + rgb.join(', ') + ')';
  if (format === 'HSL') {
    const {h,s,l} = toHSL(color);
    return 'hsl(' + displayHue(h) + ', ' + decimal(s*100) + '%, ' + decimal(l*100) + '%)';
  }
  return '#' + rgb.map(n => n.toString(16).padStart(2,'0')).join('').toUpperCase();
}

export function palette(base: Color, mode: Mode) {
  const hsl = toHSL(base);
  const shifted = (role: string, offset: number) => ({ role, color: fromHSL({ ...hsl, h: hsl.h + offset }) });
  const center = { role: 'Base', color: base };
  switch (mode) {
    case 'Complementary': return [center, shifted('Complement', 180)];
    case 'Analogous': return [shifted('Left', -30), center, shifted('Right', 30)];
    case 'Triadic': return [center, shifted('Triad 1', 120), shifted('Triad 2', 240)];
    case 'Split-complementary': return [center, shifted('Split 1', 150), shifted('Split 2', 210)];
    case 'Monochromatic': return [
      { role: 'Shade', color: fromHSL({ ...hsl, l: hsl.l * .65 }) },
      center,
      { role: 'Tint', color: fromHSL({ ...hsl, l: hsl.l + (1 - hsl.l) * .35 }) },
    ];
  }
}

export function contrastRatio(a: RGB, b: RGB) {
  const luminance = (rgb: RGB) => rgb.reduce((sum, channel, i) => {
    const value = channel / 255;
    const linear = value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    return sum + [.2126, .7152, .0722][i] * linear;
  }, 0);
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}


