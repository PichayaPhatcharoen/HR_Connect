import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";

import "./globals.css";
import NextAuthProvider from "@/components/providers/NextAuthProvider";
import QueryProvider from "@/components/providers/QueryProvider";

const notoSansThai = Noto_Sans_Thai({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "HR Chatbot",
  description: "Final Project",
  icons: {
    icon: "/favico.png",
  },

};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${notoSansThai.className} antialiased min-h-dvh bg-gray-100`}
        suppressHydrationWarning
      >
        <NextAuthProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
