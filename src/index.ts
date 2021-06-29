import { MP4BoxTransform } from '@monyone/mp4-box-transform';
import MP4FragmentTransform from './mp4-fragment-transform';
import MP4TSHLSTransform from './mp4-ts-hls-transform';

import TSSubtitleTransform from './ts-subtitle-transform';

import { ffmpeg } from './ffmpeg'

const basename = 'test';
const targetDuration = 2;
const src = process.stdin;

const subtitleTransform = new TSSubtitleTransform();

const encoding = ffmpeg(
  '/usr/bin/ffmpeg', 'mpegts', targetDuration * 1000 - 100, 
  'libx264', [], 'aac', [], []
);

src.pipe(subtitleTransform);
src.pipe(encoding.stdin);

encoding.stdout.pipe(
  new MP4BoxTransform()
).pipe(
  new MP4FragmentTransform()
).pipe(
  new MP4TSHLSTransform('/usr/bin/ffprobe', basename, targetDuration, subtitleTransform)
);
