import { Transform, TransformCallback } from 'stream';

import { MP4Box } from '@monyone/mp4-box-transform';

export default class MP4FragmentTransform extends Transform {
  private initialized: boolean = false;
  private parsing_boxes: Buffer[] = [];

  public _transform (box: Buffer, encoding: string, callback: TransformCallback): void {
    const box_type = MP4Box.type(box)

    if (!this.initialized) {
      if (box_type === 'moov') {
        this.parsing_boxes.push(box);
        const init = Buffer.concat(this.parsing_boxes);

        this.initialized = true;
        this.push(init);

        this.parsing_boxes = [];
      } else {
        this.parsing_boxes.push(box);
      }
    } else {
      if (box_type === 'mdat') {
        this.parsing_boxes.push(box);
        const fragment = Buffer.concat(this.parsing_boxes);

        this.push(fragment);

        this.parsing_boxes = [];
      }else {
        this.parsing_boxes.push(box);
      }
    }

    callback();
  }

  public _flush (callback: TransformCallback): void {
    callback();
  }
}
