import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Cuervito · Fotos de eventos deportivos",
  description:
    "La plataforma para fotógrafos deportivos. Vendé tus fotos de carreras, ciclismo y más. Los atletas encuentran las suyas con reconocimiento facial o número de dorsal.",
  metadataBase: new URL("https://cuervito.app"),
  openGraph: {
    type: "website",
    siteName: "Cuervito",
    title: "Cuervito · Fotos de eventos deportivos",
    description:
      "Encontrá tus fotos de carrera. Comprá directo al fotógrafo.",
    url: "https://cuervito.app",
  },
  twitter: {
    card: "summary",
    title: "Cuervito · Fotos de eventos deportivos",
    description: "Encontrá tus fotos de carrera. Comprá directo al fotógrafo.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "manifest", url: "/site.webmanifest" },
    ],
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
