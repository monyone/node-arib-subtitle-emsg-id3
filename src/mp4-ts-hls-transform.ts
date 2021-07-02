import { Writable, Transform, TransformCallback } from 'stream';
import { createWriteStream } from 'fs';
import path from 'path';

import TSSubtitleTransform from './ts-subtitle-transform';

import { ID3v2PRIV } from './id3';
import { emsgV1WithID3 } from './emsg';

export default class MP4TSHLSTransform extends Transform {
  private initializationSegment: Buffer | null = null;
  private bytes: number = 0;
  private currentTime: number = 0;

  private subtitle: TSSubtitleTransform;
  private emsgDuration: number | undefined;

  private basename: string;
  private writeMP4Stream: Writable;
  private writeM3U8Stream: Writable;

  public constructor(basepath: string, targetDuration: number, subtitle: TSSubtitleTransform, emsgDuration?: number) {
    super();

    this.subtitle = subtitle;
    this.emsgDuration = emsgDuration;

    this.basename = path.basename(basepath);
    this.writeMP4Stream = createWriteStream(`${basepath}.mp4`);
    this.writeM3U8Stream = createWriteStream(`${basepath}.m3u8`, { encoding: 'utf-8'});

    this.writeM3U8Stream.write("#EXTM3U\n");
    this.writeM3U8Stream.write("#EXT-X-VERSION:7\n");
    this.writeM3U8Stream.write("#EXT-X-PLAYLIST-TYPE:VOD\n");
    this.writeM3U8Stream.write(`#EXT-X-TARGETDURATION:${targetDuration}\n`);
    this.writeM3U8Stream.write("#EXT-X-MEDIA-SEQUENCE:0\n");

    this.on('finish', () => {
      this.writeM3U8Stream.write("\n");
      this.writeM3U8Stream.write("#EXT-X-ENDLIST\n");
    })
  }

  public _transform (fragment: Buffer, encoding: string, callback: TransformCallback): void {
    if (!this.initializationSegment) {
      this.initializationSegment = fragment;

      this.writeMP4Stream.write(fragment);

      this.writeM3U8Stream.write(`#EXT-X-MAP:URI="${this.basename}.mp4",BYTERANGE="${fragment.length}@${this.bytes}"\n`);

      this.bytes += fragment.length;
    } else {
      // from hls.js
      const mdhdIndex = this.initializationSegment.indexOf(Buffer.from('mdhd', 'ascii'));
      const mdhdVersion = this.initializationSegment[mdhdIndex + 4];
      const timescale = this.initializationSegment.readUInt32BE(mdhdIndex + (mdhdVersion === 0 ? 16 : 24));

      const tfhdIndex = fragment.indexOf(Buffer.from('tfhd', 'ascii'));
      const tfhdFlags = fragment.readUInt32BE(tfhdIndex + 4);
      const defaultSampleDuration = tfhdFlags & 0x000008 && fragment.readUInt32BE(tfhdIndex + 12 + (tfhdFlags & 0x000001 ? 8 : 0) + (tfhdFlags & 0x000002 ? 4 : 0));
      const trunIndex = fragment.indexOf(Buffer.from('trun', 'ascii'));
      const sampleCount = fragment.readUInt32BE(trunIndex + 8);
      const duration = (defaultSampleDuration * sampleCount) / timescale;

      const emsgs = [];
      while (!this.subtitle.empty()) {
        const data = this.subtitle.peek()!;
        const second = data.pts / 90000;

        if (second < this.currentTime + duration) {
          this.subtitle.pop();

          const timescale = 90000;
          const emsg = emsgV1WithID3(
            timescale, BigInt(data.pts),
            this.emsgDuration != null ? this.emsgDuration * timescale : 0xFFFFFFFF /* undifinite */,
            ID3v2PRIV('aribb24.js', data.pes)
          );
          emsgs.push(emsg);
        } else {
          break;
        }
      }

      const segment = Buffer.concat([
        ... emsgs,
        fragment,
      ]);

      this.writeMP4Stream.write(segment);

      const EXTINF = duration;
      this.writeM3U8Stream.write(`\n`);
      this.writeM3U8Stream.write(`#EXTINF:${EXTINF}\n`);
      this.writeM3U8Stream.write(`#EXT-X-BYTERANGE:${segment.length}@${this.bytes}\n`);
      this.writeM3U8Stream.write(`${this.basename}.mp4\n`);

      this.bytes += segment.length;
      this.currentTime += duration;
    }

    callback();
  }

  public _flush (callback: TransformCallback): void {
    callback();
  }
}
