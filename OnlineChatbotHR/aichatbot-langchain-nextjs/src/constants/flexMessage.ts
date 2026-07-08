export const faqFlexMessage = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "คำถามที่พบบ่อย (FAQ)",
          weight: "bold",
          align: "center",
          color: "#ffffff",
        },
      ],
      background: {
        type: "linearGradient",
        angle: "0deg",
        startColor: "#0A4ECC",
        endColor: "#000000",
      },
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [],
  }};

export const faqAnswerFlexMessage = {
    type: "bubble",
  header: {
    type: "box",
    layout: "vertical",
    contents: [
      { type: "text", text: "Q: ", weight: "bold", wrap: true, color: "#ffffff" },
    ],
    background: {
      type: "linearGradient",
      angle: "0deg",
      startColor: "#0A4ECC",
      endColor: "#000000",
    },
  },
  body: {
    type: "box",
    layout: "vertical",
    contents: [
      { type: "text", text: "A: ", wrap: true },
    ],
  },
  footer: {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "button",
        style: "link",
        action: {
          type: "postback",
          label: "ย้อนกลับ",
          data: "action=faq_menu",
          displayText: "ย้อนกลับ",
        },
      },
    ],
  },
};

type LineMessage = 
  | { type: 'text', text: string }
  | { type: 'flex', altText: string, contents: any }

export function buildPushNotificationFlexMessage(
  title: string,
  content: string,
  imageUrl: string,
  link?: string | null
): LineMessage {
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: title,
            weight: "bold",
            size: "lg",
            wrap: true,
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: content,
            wrap: true,
          },
        ],
      },
      hero: {
        type: "image",
        url: imageUrl,
        size: "full",
        aspectMode: "cover",
      },
      ...(link ? {
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              style: "link",
              height: "sm",
              action: {
                type: "uri",
                label: "เปิดลิงก์",
                uri: link,
              },
            },
          ],
        }
      } : {})
    },
  }
}