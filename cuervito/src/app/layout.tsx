import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { display, sans } from "~/styles/v2/fuentes";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "encontrate.app · Fotos de eventos deportivos",
  description:
    "La plataforma para fotógrafos deportivos. Vendé tus fotos de carreras, ciclismo y más. Los atletas encuentran las suyas con reconocimiento facial o número de dorsal.",
  metadataBase: new URL("https://encontrate.app"),
  openGraph: {
    type: "website",
    siteName: "encontrate.app",
    title: "encontrate.app · Fotos de eventos deportivos",
    description:
      "Encontrá tus fotos de carrera. Comprá directo al fotógrafo.",
    url: "https://encontrate.app",
  },
  twitter: {
    card: "summary",
    title: "encontrate.app · Fotos de eventos deportivos",
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

// Runs before body renders. Picks the theme in this order so the correct
// palette is applied on first paint (no FOUC):
//   1. localStorage.theme  ("light" | "dark")  — explicit user choice
//   2. Local hour: 07:00–19:00 ⇒ light, else dark
//   3. Falls back to dark if anything above throws
// The value is written to <html data-theme="…"> for the CSS token overrides
// in styles.css to key off of.
const themeInitScript = `(function(){try{
  var t = localStorage.getItem('cuervito-theme');
  if (t !== 'light' && t !== 'dark') {
    var h = new Date().getHours();
    t = (h >= 7 && h < 19) ? 'light' : 'dark';
  }
  document.documentElement.dataset.theme = t;
}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      // Unbounded y Outfit se declaran acá aunque hoy sólo las use /v2: es la
      // única forma de que sus @font-face viajen en un chunk que está siempre
      // presente. Ver el porqué en styles/v2/fuentes.ts.
      className={`${geist.variable} ${display.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
