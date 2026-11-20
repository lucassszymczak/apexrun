// Insere um bloco EXIF mínimo (DateTimeOriginal + OffsetTimeOriginal) num JPEG — para os
// testes do encaixe das fotos (critério 8) sem usar fotos pessoais.
export function exifApp1(dateTime, offset) {
  const enc = (s) => { const b = Buffer.alloc(s.length + 1); b.write(s, 'ascii'); return b; };
  const dt = enc(dateTime), off = offset ? enc(offset) : null; // 20 e 7 bytes
  // TIFF little-endian: header(8) + IFD0(2+12+4) + ExifIFD(2+12*n+4) + dados
  const nExif = off ? 2 : 1;
  const ifd0At = 8, exifAt = ifd0At + 2 + 12 + 4, dataAt = exifAt + 2 + 12 * nExif + 4;
  const tiff = Buffer.alloc(dataAt + dt.length + (off ? off.length : 0));
  tiff.write('II', 0, 'ascii'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(ifd0At, 4);
  tiff.writeUInt16LE(1, ifd0At);
  tiff.writeUInt16LE(0x8769, ifd0At + 2); tiff.writeUInt16LE(4, ifd0At + 4); tiff.writeUInt32LE(1, ifd0At + 6); tiff.writeUInt32LE(exifAt, ifd0At + 10);
  tiff.writeUInt32LE(0, ifd0At + 14);
  tiff.writeUInt16LE(nExif, exifAt);
  let e = exifAt + 2;
  tiff.writeUInt16LE(0x9003, e); tiff.writeUInt16LE(2, e + 2); tiff.writeUInt32LE(dt.length, e + 4); tiff.writeUInt32LE(dataAt, e + 8); e += 12;
  if (off) { tiff.writeUInt16LE(0x9011, e); tiff.writeUInt16LE(2, e + 2); tiff.writeUInt32LE(off.length, e + 4); tiff.writeUInt32LE(dataAt + dt.length, e + 8); e += 12; }
  tiff.writeUInt32LE(0, e);
  dt.copy(tiff, dataAt); if (off) off.copy(tiff, dataAt + dt.length);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const hdr = Buffer.alloc(4); hdr.writeUInt16BE(0xffe1, 0); hdr.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([hdr, body]);
}
export function withExif(jpeg, dateTime, offset) {
  const b = Buffer.from(jpeg);
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error('não é JPEG');
  return Buffer.concat([b.subarray(0, 2), exifApp1(dateTime, offset), b.subarray(2)]);
}
// JPEG mínimo só com cabeçalho (suficiente para o leitor de EXIF)
export function bareJpeg(dateTime, offset) { return withExif(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), dateTime, offset); }
