import { spawn } from 'child_process';
import { Readable } from 'stream'

export const ffmpeg = (
  ffmpeg_path: string, progress: boolean,
  inType: string, durationMsec: number,
  preOptions: string[],
  videoCodec: string, videoOptions: string[],
  audioCodec: string, audioOptions: string[],
  postOptions: string[]
) => {
  const ffmpeg = spawn(ffmpeg_path, [
    '-hide_banner',
    ... preOptions,
    '-f', inType,
    '-i', 'pipe:0',
    '-c:v', videoCodec, ... videoOptions,
    '-c:a', audioCodec, ... audioOptions,
    ... postOptions,
    '-f', 'mp4',
    '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
    '-frag_duration', `${durationMsec * 1000}`,
    'pipe:1',
  ], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  if (progress) {
    ffmpeg.stderr.on('data', (data) => console.error(data.toString('utf-8')));
  } else {
    ffmpeg.stderr.on('data', () => {});
  }

  return ffmpeg
}
