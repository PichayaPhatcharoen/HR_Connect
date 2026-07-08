"use server"

import StaffLayoutProvider from "@/components/providers/LayoutProvider";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <StaffLayoutProvider>
      {children}
    </StaffLayoutProvider>
  );
}
