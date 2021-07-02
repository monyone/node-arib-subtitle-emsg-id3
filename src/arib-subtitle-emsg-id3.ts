#!/usr/bin/env node

import { Command } from 'commander';
import { createReadStream } from 'fs';

import createTransform from './index'

const program = new Command();

program
  .option('-i, --input <path>', 'input mpegts path')
  .option('-o, --output <path>', 'output basepath')
  .option('--debug', 'output progress for stderr', false)
  .option('-f, --ffmpeg_path <path>', 'ffmpeg path')
  .option('-t, --target_duration <seconds>', 'TARGETDURATION of playlist', '3')
  .option('--pre_options <options>', 'ffmpeg input options')
  .option('-v, --video_codec <codec>', 'ffmpeg video codec')
  .option('--video_options <options>', 'ffmpeg video options')
  .option('-a, --audio_codec <codec>', 'ffmpeg audio codec')
  .option('--audio_options <options>', 'ffmpeg audio options')
  .option('--post_options <options>', 'ffmpeg output options')
  .option('-e, --emsg_duration <seconds>', 'fix emsg duration for Safari workaround')


program.parse(process.argv);
const options = program.opts();

const src = options.input == null || options.input === 'pipe:0' || options.input === '-' ? process.stdin : createReadStream(options.input);

const transform = createTransform({
  basepath: options.output,
  ffmpegPath: options.ffmpeg_path,
  progress: options.debug ?? false,
  targetDuration: !Number.isNaN(Number.parseInt(options.target_duration)) ? Number.parseInt(options.target_duration) : 5,
  preOptions: options.pre_options?.split(' '),
  videoCodec: options.video_codec,
  videoOptions: options.video_options?.split(' '),
  audioCodec: options.audio_codec,
  audioOptions: options.audio_options?.split(' '),
  postOptions: options.post_options?.split(' '),
  emsgDuration: !Number.isNaN(Number.parseFloat(options.emsg_duration)) ? Number.parseFloat(options.emsg_duration) : undefined,
});

src.pipe(transform);
