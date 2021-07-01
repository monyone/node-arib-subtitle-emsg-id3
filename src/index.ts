import { MP4BoxTransform } from '@monyone/mp4-box-transform';
import MP4FragmentTransform from './mp4-fragment-transform';
import MP4TSHLSTransform from './mp4-ts-hls-transform';

import TSSubtitleTransform from './ts-subtitle-transform';

import { PassThrough } from 'stream'

import { ffmpeg } from './ffmpeg'

type Options = {
  basepath: string,
  ffmpegPath: string,
  progress: boolean
  targetDuration: number,
  preOptions?: string[],
  videoCodec?: string,
  videoOptions?: string[],
  audioCodec?: string,
  audioOptions?: string[],
  postOptions?: string[],
}

export default (options: Options) => {
  const src = new PassThrough();
  const encoding = ffmpeg(
    options.ffmpegPath, options.progress,
    'mpegts',
    options.targetDuration * 1000,
    options.preOptions ?? [],
    options.videoCodec ?? 'copy', options.videoOptions ?? [],
    options.audioCodec ?? 'copy', options.audioOptions ?? [],
    options.postOptions ?? [],
  );
  const subtitleTransform = new TSSubtitleTransform();

  src.pipe(subtitleTransform);
  src.pipe(encoding.stdin);

  encoding.stdout.pipe(
    new MP4BoxTransform()
  ).pipe(
    new MP4FragmentTransform()
  ).pipe(
    new MP4TSHLSTransform(options.basepath, options.targetDuration + 1, subtitleTransform)
  );

  return src;
}


