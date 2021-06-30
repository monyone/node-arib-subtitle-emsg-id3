export const emsgV1WithID3 = (
  timescale: number,
  presentation_time: bigint,
  id3: Buffer
) => {
  const type = Buffer.from('emsg', 'ascii');
  const version = Buffer.from([1]);
  const flag = Buffer.from([0, 0, 0]);

  const header = Buffer.alloc(4 + 8 + 4 + 4);
  header.writeUInt32BE(timescale, 0); // timescale
  header.writeBigInt64BE(presentation_time, 4); // presentation_time
  header.writeUInt32BE(0xFFFFFFFF, 12); // duration
  header.writeUInt32BE(0, 16); // id

  const scheme_id_uri = Buffer.from('https://aomedia.org/emsg/ID3\0');
  const value = Buffer.from('\0');

  const payload = Buffer.concat([
    type,
    version,
    flag,
    header,
    scheme_id_uri,
    value,
    id3
  ])

  const size = Buffer.alloc(4);
  size.writeUInt32BE(payload.length + 4, 0);
  return Buffer.concat([
    size,
    payload,
  ]);
}
