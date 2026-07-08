import fs from "fs/promises";
import path from "path";

/**
 * สร้างชื่อไฟล์ตามลำดับ เช่น Document1.pdf หรือ Announcements2.png
 * โดยการสแกนไฟล์ที่มีอยู่ใน directory
 */
export async function generateSequentialUploadName(
  dirAbsolutePath: string,
  prefix: "Document" | "Announcements",
  ext: string
): Promise<string> {
  await fs.mkdir(dirAbsolutePath, { recursive: true });
  const files = await fs.readdir(dirAbsolutePath).catch(() => []);
  const pattern = new RegExp(`^${prefix}(\\d+)\\.[^.]+$`, "i");

  let maxIndex = 0;
  for (const file of files) {
    const base = path.basename(file);
    const match = base.match(pattern);
    if (!match) continue;
    const idx = Number.parseInt(match[1], 10);
    if (Number.isFinite(idx) && idx > maxIndex) {
      maxIndex = idx;
    }
  }

  return `${prefix}${maxIndex + 1}.${ext}`;
}

