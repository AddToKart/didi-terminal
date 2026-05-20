export interface JsonWorkerData {
  raw: string;
}

export type JsonType = "object" | "array" | "string" | "number" | "boolean" | "null";

function validateJson(raw: string): string | null {
  if (!raw.trim()) return null;
  try {
    JSON.parse(raw);
    return null;
  } catch (err: any) {
    return err.message;
  }
}

self.onmessage = (e: MessageEvent<JsonWorkerData>) => {
  const { raw } = e.data;
  
  const error = validateJson(raw);
  let parsed = null;
  let isJsonLike = raw.trim().startsWith("{") || raw.trim().startsWith("[");

  if (!error && isJsonLike) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  self.postMessage({ error, parsed, isJsonLike });
};