import type { Metadata, Viewport } from "next";
import { Azeret_Mono, Sora } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { PAGE_DESCRIPTION, PAGE_TITLE, SITE_NAME } from "@/lib/constants";

import "./globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const azeretMono = Azeret_Mono({ subsets: ["latin"], variable: "--font-azeret-mono", display: "swap" });

export const viewport: Viewport = { themeColor: "#eef5fc" };

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    applicationName: SITE_NAME,
    alternates: { canonical: "/" },
    openGraph: {
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      url: "/",
      siteName: SITE_NAME,
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: PAGE_TITLE }],
    },
    twitter: {
      card: "summary_large_image",
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      images: ["/opengraph-image"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${sora.variable} ${azeretMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
