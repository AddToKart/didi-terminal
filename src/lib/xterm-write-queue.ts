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
  let isWriting = false;
  let disposed = false;
  const queue: QueuedWrite[] = [];

  const flush = () => {
    if (disposed || isWriting || queue.length === 0) return;

    isWriting = true;
    
    // Merge pending strings to avoid excessive callbacks
    if (typeof queue[0].data === "string" && !queue[0].callback) {
        let mergedData = queue.shift()!.data as string;
        while (queue.length > 0 && typeof queue[0].data === "string" && !queue[0].callback) {
            mergedData += queue.shift()!.data as string;
            // limit merge size to avoid freezing the renderer with a massive string
            if (mergedData.length > 65536) break; 
        }
        try {
          terminal.write(mergedData, () => {
            isWriting = false;
            flush();
          });
        } catch (e) {
          disposed = true;
          isWriting = false;
        }
        return;
    }

    // Merge pending bytes
    if (isBytes(queue[0].data) && !queue[0].callback) {
        const chunks = [queue.shift()!.data as Uint8Array];
        let totalLen = chunks[0].length;
        while (queue.length > 0 && isBytes(queue[0].data) && !queue[0].callback) {
            if (totalLen > 65536) break;
            const next = queue.shift()!.data as Uint8Array;
            chunks.push(next);
            totalLen += next.length;
        }
        try {
          terminal.write(mergeBytes(chunks), () => {
            isWriting = false;
            flush();
          });
        } catch (e) {
          disposed = true;
          isWriting = false;
        }
        return;
    }

    // Handle single item with callback or normal
    const item = queue.shift()!;
    try {
      terminal.write(item.data, () => {
        if (item.callback) item.callback();
        isWriting = false;
        flush();
      });
    } catch (error) {
      disposed = true;
      isWriting = false;
    }
  };

  return {
    write(data: XtermWriteData, callback?: () => void) {
      if (disposed) return;
      queue.push({ data, callback });
      flush();
    },
    flush() {},
    dispose() {
      disposed = true;
      queue.length = 0;
    },
  };
};