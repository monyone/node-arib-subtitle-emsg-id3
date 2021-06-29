import { Writable, Transform, TransformCallback } from 'stream';
import { createWriteStream } from 'fs';
import path from 'path';

import TSSubtitleTransform from './ts-subtitle-transform'
import { getStats } from './ffprobe';

import { ID3v2PRIV } from './id3'
import { emsgV1WithID3 } from './emsg'

export default class MP4TSHLSTransform extends Transform {
  private initializationSegment: Buffer | null = null;
  private bytes: number = 0;

  private subtitle: TSSubtitleTransform;

  private ffprobe_path: string;

  private basename: string;
  private writeMP4Stream: Writable;
  private writeM3U8Stream: Writable;

  public constructor(ffprobe_path: string, basepath: string, targetDuration: number, subtitle: TSSubtitleTransform) {
    super();

    this.subtitle = subtitle;

    this.ffprobe_path = ffprobe_path;

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
      const { start_time, duration } = getStats(
        this.ffprobe_path,
        Buffer.concat([this.initializationSegment, fragment])
      );

      const emsgs = [];
      while (!this.subtitle.empty()) {
        const data = this.subtitle.peek()!;
        const second = data.pts / 90000;

        if (second < duration) {
          this.subtitle.pop();

          const emsg = emsgV1WithID3(90000, BigInt(data.pts), ID3v2PRIV('aribb24.js', data.pes))
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

      const EXTINF = duration - start_time;
      this.writeM3U8Stream.write(`\n`);
      this.writeM3U8Stream.write(`#EXTINF:${EXTINF}\n`);
      this.writeM3U8Stream.write(`#EXT-X-BYTERANGE:${segment.length}@${this.bytes}\n`);
      this.writeM3U8Stream.write(`${this.basename}.mp4\n`);

      this.bytes += segment.length;
    }

    callback();
  }

  public _flush (callback: TransformCallback): void {
    callback();
  }
}
