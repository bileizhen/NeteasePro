import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Netease Pro",
  description: "A beautiful Netease Cloud Music client with Liquid Glass UI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased selection:bg-blue-500/30 selection:text-blue-900 dark:selection:text-blue-100">
        {children}
      </body>
    </html>
  );
}
