import { create, type BitMatrix, type QRCodeErrorCorrectionLevel } from 'qrcode';

import { parseHex } from './color.ts';

export type Appearance = { foreground: string; background: string; margin: number };
export type QR = Appearance & { matrix: BitMatrix };

function luminance(hex: string) {
  const [r, g, b] = parseHex(hex)!.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function scanColorWarnings(colors: Pick<Appearance, 'foreground' | 'background'>) {
  const foreground = luminance(colors.foreground);
  const background = luminance(colors.background);
  const ratio = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  return { inverted: foreground > background, lowContrast: ratio < 3 };
}

export function urlPayload(value: string) {
  const text = value.trim();
  const explicit = /^https?:\/\//i.test(text);
  const address = explicit ? text : 'https://' + text;
  const authority = address.match(/^https?:\/\/([^/?#]+)/i)?.[1];
  if (!authority || /[\s\\]/u.test(text) || authority.includes('@')) {
    throw new Error('Expected a web address with a hostname.');
  }
  const { hostname } = new URL(address);
  const ipv6 = hostname.startsWith('[');
  const labels = hostname.replace(/\.$/, '').split('.');
  if (!ipv6 && (hostname.length > 254 ||
    labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) ||
    (!explicit && !authority.includes('.') && hostname !== 'localhost'))) {
    throw new Error('Expected a valid hostname.');
  }
  return address;
}

function escapeWifi(value: string) {
  return value.replace(/[\\;:,"]/g, character => '\\' + character);
}

export function wifiPayload(ssid: string, security: string, password: string, hidden: boolean) {
  const credentials = security === 'nopass' ? '' : 'P:' + escapeWifi(password) + ';';
  return 'WIFI:T:' + security + ';S:' + escapeWifi(ssid) + ';' +
    credentials + 'H:' + String(hidden) + ';;';
}

export function generateQR(payload: string, errorCorrectionLevel: QRCodeErrorCorrectionLevel): BitMatrix {
  return create(payload, { errorCorrectionLevel }).modules;
}

export function fitsRaster(qr: QR, size: number) {
  return size >= qr.matrix.size + qr.margin * 2;
}

export function paintQR(canvas: HTMLCanvasElement, qr: QR, size: number) {
  const scale = Math.floor(size / (qr.matrix.size + qr.margin * 2));
  if (scale < 1) throw new Error('Choose a larger PNG size.');
  const offset = Math.floor((size - qr.matrix.size * scale) / 2);
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Unable to render the QR image.');
  ctx.fillStyle = qr.background;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = qr.foreground;
  for (let row = 0; row < qr.matrix.size; row++) {
    for (let col = 0; col < qr.matrix.size; col++) {
      if (qr.matrix.get(row, col)) ctx.fillRect(offset + col * scale, offset + row * scale, scale, scale);
    }
  }
}

export function qrSVG(qr: QR) {
  const size = qr.matrix.size + qr.margin * 2;
  const path: string[] = [];
  for (let row = 0; row < qr.matrix.size; row++) {
    for (let col = 0; col < qr.matrix.size; col++) {
      if (qr.matrix.get(row, col)) path.push('M' + (col + qr.margin) + ' ' + (row + qr.margin) + 'h1v1h-1z');
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size +
    '" shape-rendering="crispEdges"><rect width="' + size + '" height="' + size + '" fill="' + qr.background +
    '"/><path fill="' + qr.foreground + '" d="' + path.join('') + '"/></svg>';
}
