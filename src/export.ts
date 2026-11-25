import { isTauri } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { writeImage } from '@tauri-apps/plugin-clipboard-manager';
import { paintQR, qrSVG, type QR } from './qr';

async function png(qr: QR, size: number) {
  const canvas = document.createElement('canvas');
  paintQR(canvas, qr, size);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png');
  });
}

export async function saveQR(qr: QR, size: number, format: 'png' | 'svg') {
  if (!isTauri()) throw new Error('Open FruityQR in the desktop app to save files.');
  const destination = await save({
    defaultPath: 'fruityqr.' + format,
    filters: [{ name: format.toUpperCase() + ' image', extensions: [format] }],
  });
  if (!destination) return false;
  const bytes = format === 'svg'
    ? new TextEncoder().encode(qrSVG(qr))
    : new Uint8Array(await (await png(qr, size)).arrayBuffer());
  await writeFile(destination, bytes);
  return true;
}

export async function copyQR(qr: QR, size: number) {
  if (isTauri()) {
    await writeImage(new Uint8Array(await (await png(qr, size)).arrayBuffer()));
  } else {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png(qr, size) })]);
  }
}
