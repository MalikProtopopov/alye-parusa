import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";

const unbounded = Unbounded({
  weight: ["500", "600", "700"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
});

const manrope = Manrope({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Алые Паруса · Админка",
  description: "Панель управления контентом сайта «Алые Паруса»",
  // Админка не должна попадать в поисковую выдачу (страховка к заголовкам
  // X-Robots-Tag на реверс-прокси).
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }],
  },
};

// <meta name="color-scheme" content="light">: светлая палитра админки не
// должна принудительно затемняться браузером (Chrome Auto-dark на Android).
export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${unbounded.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
