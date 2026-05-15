import "~/styles/prototype/styles.css";
import "~/styles/prototype/panel-anim.css";
import "~/styles/prototype/public-event.css";
import "~/styles/prototype/lightbox.css";

import { ExternalStylesheets } from "~/app/_components/external-stylesheets";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ExternalStylesheets />
      {children}
    </>
  );
}
