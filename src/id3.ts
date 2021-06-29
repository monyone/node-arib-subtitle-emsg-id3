export const ID3v2TXXX = (description: string, text: string) => {
  const txxx_payload = Buffer.concat([
    Buffer.from([0x03]), // utf-8
    Buffer.from(description, 'utf-8'),
    Buffer.from([0x00]),
    Buffer.from(text, 'utf-8'),
    Buffer.from([0x00]), // for video.js TXXX handling (必ず NULL 終端にしておく方がいい、 NULL 終端前提の場合がある)
  ]);
  const txxx_paylaod_size = Buffer.from([
    ((txxx_payload.length & 0xFE00000) >> 21),
    ((txxx_payload.length & 0x01FC000) >> 14),
    ((txxx_payload.length & 0x0003F80) >>  7),
    ((txxx_payload.length & 0x000007F) >>  0),
  ]);
  const txxx_frame = Buffer.concat([
    Buffer.from('TXXX', 'utf-8'),
    txxx_paylaod_size,
    Buffer.from([0x00, 0x00]),
    txxx_payload,
  ]);
  const txxx_frame_size = Buffer.from([
    ((txxx_frame.length & 0xFE00000) >> 21),
    ((txxx_frame.length & 0x01FC000) >> 14),
    ((txxx_frame.length & 0x0003F80) >>  7),
    ((txxx_frame.length & 0x000007F) >>  0),
  ]);

  return Buffer.concat([
    Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]),
    txxx_frame_size,
    txxx_frame,
  ]);
}

export const ID3v2PRIV = (owner: string, binary: Buffer) => {
  const priv_payload = Buffer.concat([
    Buffer.from(owner, 'utf-8'),
    Buffer.from([0x00]),
    binary
  ]);
  const priv_paylaod_size = Buffer.from([
    ((priv_payload.length & 0xFE00000) >> 21),
    ((priv_payload.length & 0x01FC000) >> 14),
    ((priv_payload.length & 0x0003F80) >>  7),
    ((priv_payload.length & 0x000007F) >>  0),
  ]);
  const priv_frame = Buffer.concat([
    Buffer.from('PRIV', 'utf-8'),
    priv_paylaod_size,
    Buffer.from([0x00, 0x00]),
    priv_payload,
  ]);
  const priv_frame_size = Buffer.from([
    ((priv_frame.length & 0xFE00000) >> 21),
    ((priv_frame.length & 0x01FC000) >> 14),
    ((priv_frame.length & 0x0003F80) >>  7),
    ((priv_frame.length & 0x000007F) >>  0),
  ]);

  return Buffer.concat([
    Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]),
    priv_frame_size,
    priv_frame,
  ]);
}
