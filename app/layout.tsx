import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "drop.",
  description: "Private peer-to-peer file transfer.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
