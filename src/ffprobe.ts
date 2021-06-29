import { spawnSync } from 'child_process'

export const getStats = (ffprobe_path: string, input: Buffer) => {
  const ffprobe = spawnSync(ffprobe_path, [
    '-hide_banner',
    '-show_entries', 'format=start_time,duration',
    '-of', 'csv=print_section=0',
    '-i', '-',
  ], {
    input: input,
    encoding: 'utf-8',
  });

  const [start_time, duration] = ffprobe.stdout.trim().split(',').map((elem) => Number.parseFloat(elem));

  return {
    start_time,
    duration
  }
}