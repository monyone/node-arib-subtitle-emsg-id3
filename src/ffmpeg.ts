import { spawn } from 'child_process';
import { Readable } from 'stream'

export const ffmpeg = (
  ffmpeg_path: string, inType: string, durationMsec: number,
  videoCodec: string, videoOptions: string[],
  audioCodec: string, audioOptions: string[],
  otherOptions: string[]
) => {
  const ffmpeg = spawn(ffmpeg_path, [
    /* '-hide_banner', */
    '-f', inType,
    '-i', 'pipe:0',
    '-c:v', videoCodec, ... videoOptions,
    '-c:a', audioCodec, ... audioOptions,
    ... otherOptions,
    '-f', 'mp4',
    '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
    '-frag_duration', `${durationMsec * 1000}`,
    'pipe:1',
  ], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  ffmpeg.on('error', (data) => console.log(data));

  return ffmpeg
}
