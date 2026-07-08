/** รูปใน public ที่เพิ่ม runtime — ข้าม next/image optimizer ป้องกัน "received null" จาก sharp */
export function shouldBypassImageOptimization(src: string): boolean {
  if (!src) return false;
  return src.startsWith("/uploads/") || src.startsWith("/users/");
}
