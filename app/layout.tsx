import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Drop",
  description: "Transfer files directly between devices with fast, secure peer-to-peer sharing.",
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
