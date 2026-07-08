'use server'
import StaffLayoutProvider from '@/components/providers/StaffLayoutProvider'
import { auth } from '@/lib/auth'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return <StaffLayoutProvider session={session}>{children}</StaffLayoutProvider>
}
