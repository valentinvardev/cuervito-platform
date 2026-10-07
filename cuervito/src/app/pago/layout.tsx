import "~/styles/prototype/styles.css";
import "~/styles/prototype/pago.css";

import { type Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PagoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
      />
      {children}
    </>
  );
}
