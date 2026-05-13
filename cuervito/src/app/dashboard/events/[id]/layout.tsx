// Loads the prototype's event-detail CSS *after* the general dashboard CSS
// so its more specific rules (e.g. upload-zone, photo-grid) win in cascade.
import "~/styles/prototype/event-detail.css";
import "~/styles/prototype/lightbox.css";

export default function EventDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
