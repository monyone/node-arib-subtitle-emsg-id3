#!/usr/bin/env node

import { Command } from 'commander';
import { createReadStream } from 'fs';

import createTransform from './index'

const program = new Command();

program
  .option('-i, --input <path>', 'input mpegts path')
  .option('-o, --output <path>', 'output basepath')
  .option('-d, --debug', 'output progress for stderr', false)
  .option('--ffmpeg_path <path>', 'ffmpeg path')
  .option('-t, --target_duration <sec>', 'TARGETDURATION of playlist', '3')
  .option('-v, --video_codec <codec>', 'video codec')
  .option('--video_options <options>', 'video options')
  .option('-a, --audio_codec <codec>', 'audio codec')
  .option('--audio_options <options>', 'audio options')
  .option('--other_options <options>', 'other options')


program.parse(process.argv);
const options = program.opts();

const src = options.input == null || options.input === 'pipe:0' || options.input === '-' ? process.stdin : createReadStream(options.input);

const transform = createTransform({
  basepath: options.output,
  ffmpegPath: options.ffmpeg_path,
  progress: options.debug,
  targetDuration: options.target_duration ?? Number.parseInt(options.target_duration),
  videoCodec: options.video_codec,
  videoOptions: options.video_options?.split(' '),
  audioCodec: options.audio_codec,
  audioOptions: options.audio_options?.split(' '),
  otherOptions: options.other_options?.split(' '),
});

src.pipe(transform);
