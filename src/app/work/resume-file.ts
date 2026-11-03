import { statSync } from "node:fs";
import { join } from "node:path";

/** "100 KB", "1.2 MB": the size a download label shows. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The real size of a file in public/ (`/work/x.pdf`), read when the page is built, so the label
 * follows the file whenever `npm run resume` reprints it. Null if it can't be read: the label
 * then leaves the size out rather than guess.
 */
export function publicFileSize(publicPath: string): string | null {
  try {
    return formatFileSize(statSync(join(process.cwd(), "public", publicPath)).size);
  } catch {
    return null;
  }
}
