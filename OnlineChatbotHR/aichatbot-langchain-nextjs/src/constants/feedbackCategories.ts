export const FEEDBACK_CATEGORIES = [
  { id: "DATA_ACCURACY", name: "ความถูกต้องและความชัดเจนของข้อมูล" },
  { id: "RESPONSE_TIME", name: "ความรวดเร็วในการได้รับคำตอบ" },
  { id: "DOCUMENT_ACCESSIBILITY", name: "ความง่ายในการค้นหาและดาวน์โหลดเอกสาร" },
  { id: "SERVICE_QUALITY", name: "คุณภาพการให้บริการและการประสานงานของเจ้าหน้าที่" },
  { id: "CHANNEL_USABILITY", name: "ความสะดวกในการใช้งานผ่าน LINE/Website" },
] as const;

export type FeedbackCategoryId = (typeof FEEDBACK_CATEGORIES)[number]["id"];
