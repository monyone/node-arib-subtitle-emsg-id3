#!/usr/bin/env node

import { Transform, TransformCallback } from 'stream'

import { TSPacket, TSPacketQueue } from 'arib-mpeg2ts-parser';
import { TSSection, TSSectionQueue, TSSectionPacketizer } from 'arib-mpeg2ts-parser';
import { TSPES, TSPESQueue } from 'arib-mpeg2ts-parser';

type PESData = {
  pts: number,
  pes: Buffer,
};

export default class TSSubtitleTransform extends Transform {
  private packetQueue = new TSPacketQueue();

  private PAT_TSSectionQueue = new TSSectionQueue();

  private PMT_TSSectionQueues = new Map<number, TSSectionQueue>();
  private PMT_SubtitlePids = new Map<number, number>();
  private PMT_PCRPids = new Map<number, number>();
  private PMT_PCRs = new Map<number, number>();

  private Subtitle_TSPESQueues = new Map<number, TSPESQueue>();
  private Subtitle_PMTPids = new Map<number, Set<number>>();

  private PCR_PMTPids = new Map<number, Set<number>>();
  private PCRPids = new Set<number>();

  private queue: PESData[] = [];

  _transform (chunk: Buffer, encoding: string, callback: TransformCallback): void {
    this.packetQueue.push(chunk);
    while (!this.packetQueue.isEmpty()) {
      const packet = this.packetQueue.pop()!;

      const pid = TSPacket.pid(packet);

      if (pid == 0x00) {
        this.PAT_TSSectionQueue.push(packet)
        while (!this.PAT_TSSectionQueue.isEmpty()) {
          const PAT = this.PAT_TSSectionQueue.pop()!;
          if (TSSection.CRC32(PAT) != 0) { continue; }

          let begin = TSSection.EXTENDED_HEADER_SIZE;
          while (begin < TSSection.BASIC_HEADER_SIZE + TSSection.section_length(PAT) - TSSection.CRC_SIZE) {
            const program_number = (PAT[begin + 0] << 8) | PAT[begin + 1];
            const program_map_PID = ((PAT[begin + 2] & 0x1F) << 8) | PAT[begin + 3];
            if (program_map_PID === 0x10) { begin += 4; continue; } // NIT

            if (!this.PMT_TSSectionQueues.has(program_map_PID)) {
              this.PMT_TSSectionQueues.set(program_map_PID, new TSSectionQueue());
            }

            begin += 4;
          }
        }

        // this.push(packet);
      } else if (this.PMT_TSSectionQueues.has(pid)) {
        const PMT_TSSectionQueue = this.PMT_TSSectionQueues.get(pid)!;

        PMT_TSSectionQueue.push(packet);
        while (!PMT_TSSectionQueue.isEmpty()) {
          const PMT = PMT_TSSectionQueue.pop()!;
          if (TSSection.CRC32(PMT) != 0) { continue; }

          const program_info_length = ((PMT[TSSection.EXTENDED_HEADER_SIZE + 2] & 0x0F) << 8) | PMT[TSSection.EXTENDED_HEADER_SIZE + 3];

          const PCR_PID = ((PMT[TSSection.EXTENDED_HEADER_SIZE + 0] & 0x1F) << 8) | PMT[TSSection.EXTENDED_HEADER_SIZE + 1];

          if (!this.PMT_PCRPids.has(pid)) {
            this.PMT_PCRPids.set(pid, PCR_PID);
            {
              const set = this.PCR_PMTPids.get(PCR_PID) ?? new Set<number>();
              set.add(pid);
              this.PCR_PMTPids.set(PCR_PID, set);
            }
            this.PCRPids.add(PCR_PID);
          }

          let subtitlePid = -1;

          let begin = TSSection.EXTENDED_HEADER_SIZE + 4 + program_info_length;
          while (begin < TSSection.BASIC_HEADER_SIZE + TSSection.section_length(PMT) - TSSection.CRC_SIZE) {
            const stream_type = PMT[begin + 0];
            const elementary_PID = ((PMT[begin + 1] & 0x1F) << 8) | PMT[begin + 2];
            const ES_info_length = ((PMT[begin + 3] & 0x0F) << 8) | PMT[begin + 4];

            let descriptor = begin + 5;
            while (descriptor < begin + 5 + ES_info_length) {
              const descriptor_tag = PMT[descriptor + 0];
              const descriptor_length = PMT[descriptor + 1];

              if (descriptor_tag == 0x52) {
                const component_tag = PMT[descriptor + 2];

                if (0x30 <= component_tag && component_tag <= 0x37 || component_tag == 0x87) {
                  subtitlePid = elementary_PID;
                }
              }

              descriptor += 2 + descriptor_length;
            }

            begin += 5 + ES_info_length;
          }

          if (subtitlePid >= 0) {
            if (!this.PMT_SubtitlePids.has(pid)) {
              this.PMT_SubtitlePids.set(pid, subtitlePid);

              {
                const set = this.Subtitle_PMTPids.get(subtitlePid) ?? new Set<number>();
                set.add(pid);
                this.Subtitle_PMTPids.set(subtitlePid, set);
              }

              if (!this.Subtitle_TSPESQueues.has(subtitlePid)) {
                this.Subtitle_TSPESQueues.set(subtitlePid, new TSPESQueue());
              }
            }
          } else {
            if (this.PMT_SubtitlePids.has(pid)) {
              const oldSubtitlePid = this.PMT_SubtitlePids.get(pid)!;
              this.PMT_SubtitlePids.delete(pid);

              {
                const set = this.Subtitle_PMTPids.get(subtitlePid) ?? new Set<number>();
                set.delete(pid);                
                this.Subtitle_PMTPids.set(subtitlePid, set);
              }

              if (!this.Subtitle_PMTPids.has(subtitlePid) || this.Subtitle_PMTPids.get(subtitlePid)!.size === 0) {
                this.Subtitle_TSPESQueues.delete(subtitlePid);
              }
            }
          }
        }

        // this.push(packet);
      } else if (this.Subtitle_TSPESQueues.has(pid)) {
        const Subtitle_TSPESQueue = this.Subtitle_TSPESQueues.get(pid)!;

        Subtitle_TSPESQueue.push(packet);
        while (!Subtitle_TSPESQueue.isEmpty()) {
          const SubtitlePES = Subtitle_TSPESQueue.pop()!;

          let pts = 0;
          pts *= (1 << 3); pts += ((SubtitlePES[TSPES.PES_HEADER_SIZE + 3 + 0] & 0x0E) >> 1);
          pts *= (1 << 8); pts += ((SubtitlePES[TSPES.PES_HEADER_SIZE + 3 + 1] & 0xFF) >> 0);
          pts *= (1 << 7); pts += ((SubtitlePES[TSPES.PES_HEADER_SIZE + 3 + 2] & 0xFE) >> 1);
          pts *= (1 << 8); pts += ((SubtitlePES[TSPES.PES_HEADER_SIZE + 3 + 3] & 0xFF) >> 0);
          pts *= (1 << 7); pts += ((SubtitlePES[TSPES.PES_HEADER_SIZE + 3 + 4] & 0xFE) >> 1);

          const PES_header_data_length = SubtitlePES[TSPES.PES_HEADER_SIZE + 2];
          const PES_data_packet_header_length = (SubtitlePES[(TSPES.PES_HEADER_SIZE + 3) + PES_header_data_length + 2] & 0x0F);
          const data_group = TSPES.PES_HEADER_SIZE + (3 + PES_header_data_length) + (3 + PES_data_packet_header_length);
          const data_group_id = (SubtitlePES[data_group + 0] & 0xFC) >> 2;

          if ((data_group_id & 0x0F) != 1) { // FIXME!
            continue; // FIXME!
          } // FIXME!

          const subtitleData = SubtitlePES.slice(TSPES.PES_HEADER_SIZE + (3 + PES_header_data_length));

          for (const PMT_PID of Array.from(this.Subtitle_PMTPids.get(pid) ?? [])) {
            if (!this.PMT_PCRs.has(PMT_PID)) { continue; }
            const PCR = this.PMT_PCRs.get(PMT_PID)!;

            let modified_pts = pts - PCR;
            if (modified_pts < 0) { modified_pts += 2 ** 33; }

            this.queue.push({ pts: modified_pts, pes: subtitleData });
          }
        }
        // this.push(packet);
      } else if(this.PCRPids.has(pid)) {
        for (const PMT_PID of Array.from(this.PCR_PMTPids.get(pid) ?? [])) {
          if (!this.PMT_PCRs.has(PMT_PID) && TSPacket.has_pcr(packet)) {
            this.PMT_PCRs.set(PMT_PID, TSPacket.pcr(packet));
          }
        }
      } else {
        // this.push(packet);
      }
    }
    callback();
  }

  _flush (callback: TransformCallback): void {
    callback();
  }

  public peek(): PESData | undefined {
    return this.queue.length > 0 ? this.queue[0] : undefined;
  }

  public pop(): PESData | undefined {
    return this.queue.shift();
  }

  public empty(): boolean {
    return this.queue.length === 0;
  }
}
