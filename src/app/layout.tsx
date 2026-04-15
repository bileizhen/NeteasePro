import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} antialiased selection:bg-blue-500/30 selection:text-blue-900 dark:selection:text-blue-100`}>
        {children}
      </body>
    </html>
  );
}
