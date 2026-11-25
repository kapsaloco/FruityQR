import assert from 'node:assert/strict';
import test from 'node:test';
import { fitsRaster, generateQR, paintQR, qrSVG, scanColorWarnings, urlPayload, wifiPayload } from '../src/qr.ts';

test('URL payload defaults bare addresses to HTTPS and preserves explicit HTTP(S)', () => {
  assert.equal(urlPayload(' example.com/path?q=1#top '), 'https://example.com/path?q=1#top');
  assert.equal(urlPayload('example.com:8443'), 'https://example.com:8443');
  assert.equal(urlPayload('http://localhost:1420'), 'http://localhost:1420');
  assert.equal(urlPayload('https://example.com'), 'https://example.com');
  assert.equal(urlPayload('[::1]:8080'), 'https://[::1]:8080');
});

test('URL payload rejects invalid hosts, ports, credentials, and other schemes', () => {
  for (const input of [
    '', 'hello', 'two words.com', 'example..com', 'example.com:65536', 'user@example.com',
    'https://user:password@example.com', 'ftp://example.com', 'javascript:alert(1)',
    'https:///example.com',
  ]) {
    assert.throws(() => urlPayload(input), undefined, input);
  }
});

test('Wi-Fi payload escapes reserved characters and preserves Unicode', () => {
  const ssid = String.raw`Café\Lab;5:G,"guest"`;
  const password = String.raw`pass;word:\,"`;
  const expected = String.raw`WIFI:T:WPA;S:Café\\Lab\;5\:G\,\"guest\";P:pass\;word\:\\\,\";H:true;;`;
  assert.equal(wifiPayload(ssid, 'WPA', password, true), expected);
  assert.equal(wifiPayload('Legacy', 'WEP', '12345', false), 'WIFI:T:WEP;S:Legacy;P:12345;H:false;;');
});

test('open Wi-Fi payload omits the password', () => {
  assert.equal(wifiPayload('Guest', 'nopass', 'previous password', false), 'WIFI:T:nopass;S:Guest;H:false;;');
});

test('QR generation handles Unicode and whitespace at every correction level', () => {
  const payload = '  Γεια σου 🍐\nSecond line  ';
  for (const level of ['L', 'M', 'Q', 'H']) {
    const matrix = generateQR(payload, level);
    assert.equal(matrix.data.length, matrix.size ** 2, level);
    assert.equal(matrix.get(0, 0), 1, level);
    assert.notDeepEqual(matrix.data, generateQR(payload.trim(), level).data, level);
  }
});

test('QR generation rejects payloads that exceed QR capacity', () => {
  assert.throws(() => generateQR('a'.repeat(5000), 'H'));
});

test('scan color warnings distinguish inverted colors from low contrast', () => {
  assert.deepEqual(scanColorWarnings({ foreground: '#000000', background: '#FFFFFF' }), {
    inverted: false, lowContrast: false,
  });
  assert.deepEqual(scanColorWarnings({ foreground: '#FFFFFF', background: '#000000' }), {
    inverted: true, lowContrast: false,
  });
  assert.deepEqual(scanColorWarnings({ foreground: '#777777', background: '#888888' }), {
    inverted: false, lowContrast: true,
  });
  assert.deepEqual(scanColorWarnings({ foreground: '#888888', background: '#777777' }), {
    inverted: true, lowContrast: true,
  });
});

const sample = {
  matrix: { size: 3, get: (row, col) => row + col === 2 },
  foreground: '#17381B',
  background: '#F7FFE2',
  margin: 4,
};

test('raster rendering uses whole modules, exact dimensions, and a minimum quiet zone', () => {
  const fills = [];
  const context = {
    fillStyle: '',
    fillRect(...rect) { fills.push([this.fillStyle, ...rect]); },
  };
  const canvas = {
    getContext(type, options) {
      assert.equal(type, '2d');
      assert.deepEqual(options, { alpha: false });
      return context;
    },
  };

  assert.equal(fitsRaster(sample, 10), false);
  assert.equal(fitsRaster(sample, 11), true);
  assert.throws(() => paintQR(canvas, sample, 10), /larger PNG size/);
  paintQR(canvas, sample, 25);

  assert.equal(canvas.width, 25);
  assert.equal(canvas.height, 25);
  assert.deepEqual(fills, [
    ['#F7FFE2', 0, 0, 25, 25],
    ['#17381B', 13, 9, 2, 2],
    ['#17381B', 11, 11, 2, 2],
    ['#17381B', 9, 13, 2, 2],
  ]);
});

test('SVG output includes a solid background and vector modules inside the quiet zone', () => {
  const svg = qrSVG(sample);
  assert.match(svg, /viewBox="0 0 11 11"/);
  assert.match(svg, /<rect width="11" height="11" fill="#F7FFE2"\/>/);
  assert.match(svg, /<path fill="#17381B" d="M6 4h1v1h-1zM5 5h1v1h-1zM4 6h1v1h-1z"\/>/);
  assert.doesNotMatch(svg, /<image\b/);
});
