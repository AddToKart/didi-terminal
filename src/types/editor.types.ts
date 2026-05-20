export interface EditorTab {
  id: string;
  filePath: string;
  fileName: string;
  language: string;
  content: string;
  isDirty: boolean;
  scrollTop?: number;
}

export interface EditorFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  extension?: string | null;
}
