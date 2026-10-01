import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MailGuard - Private Email Verification & Deliverability Intelligence",
  description: "Self-hosted, autonomous email deliverability intelligence and direct SMTP verification engine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
