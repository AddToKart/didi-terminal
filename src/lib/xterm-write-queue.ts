import type { Terminal } from "@xterm/xterm";

export type XtermWriteData = string | Uint8Array;

interface QueuedWrite {
  data: XtermWriteData;
  callback?: () => void;
}

const isBytes = (value: XtermWriteData): value is Uint8Array => value instanceof Uint8Array;

const mergeBytes = (items: Uint8Array[]) => {
  const length = items.reduce((total, item) => total + item.length, 0);
  const merged = new Uint8Array(length);
  let offset = 0;

  for (const item of items) {
    merged.set(item, offset);
    offset += item.length;
  }

  return merged;
};

export const createXtermWriteQueue = (terminal: Terminal) => {
  let frame: number | null = null;
  let disposed = false;
  const queue: QueuedWrite[] = [];

  const writeSafely = (data: XtermWriteData, callback?: () => void) => {
    if (disposed) return;

    try {
      terminal.write(data, callback);
    } catch (error) {
      disposed = true;
      console.warn("Skipped write for disposed terminal:", error);
    }
  };

  const flush = () => {
    frame = null;
    if (disposed) return;

    while (queue.length > 0) {
      const first = queue.shift();
      if (!first) return;

      if (first.callback) {
        writeSafely(first.data, first.callback);
        continue;
      }

      if (typeof first.data === "string") {
        let data = first.data;
        while (queue.length > 0 && typeof queue[0].data === "string" && !queue[0].callback) {
          const next = queue.shift();
          if (next && typeof next.data === "string") data += next.data;
        }
        writeSafely(data);
        continue;
      }

      const chunks = [first.data];
      while (queue.length > 0 && isBytes(queue[0].data) && !queue[0].callback) {
        const next = queue.shift();
        if (next && isBytes(next.data)) chunks.push(next.data);
      }
      writeSafely(mergeBytes(chunks));
    }
  };

  const schedule = () => {
    if (frame !== null || disposed) return;
    frame = requestAnimationFrame(flush);
  };

  return {
    write(data: XtermWriteData, callback?: () => void) {
      if (disposed) return;
      queue.push({ data, callback });
      schedule();
    },
    flush,
    dispose() {
      disposed = true;
      queue.length = 0;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
  };
};
