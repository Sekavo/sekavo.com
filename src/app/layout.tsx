import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sekavo.com"),
  title: {
    default: "Sekavo — Get paid without the chasing.",
    template: "%s · Sekavo",
  },
  description:
    "Sekavo follows up on your unpaid invoices automatically — polite, escalating sequences that pause the moment a customer replies. Built for freelancers, consultants and small studios who'd rather do the work than chase it.",
  openGraph: {
    title: "Sekavo — Get paid without the chasing.",
    description:
      "Automated invoice follow-ups that stay professional, pause when customers reply, and cancel the moment you're paid. For freelancers, consultants and small agencies.",
    url: "https://sekavo.com",
    siteName: "Sekavo",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sekavo — Get paid without the chasing.",
    description:
      "Automated invoice follow-ups that stay professional, pause when customers reply, and cancel the moment you're paid.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
