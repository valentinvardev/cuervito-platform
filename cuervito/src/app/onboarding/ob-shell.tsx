/**
 * Shared shell for /onboarding/* — replicates the prototype layout
 * (designs/onboarding.html): desktop with sidebar + stepper, mobile
 * with horizontal stepper on top.
 */
import Link from "next/link";

type Step = 1 | 2;

export function ObShell({ step, children }: { step: Step; children: React.ReactNode }) {
  const profileDone = step > 1;
  return (
    <>
      {/* Mobile progress (horizontal stepper) */}
      <div className="ob-mobile-progress">
        <div className="row">
          <Link href="/" className="logo">
            cuerv<span className="logo-dot"></span>to
          </Link>
          <span className="step-num">
            <span>{step}</span> / 2
          </span>
        </div>
        <div className="ob-mstepper">
          <div className={`ob-mstep ${step === 1 ? "active" : profileDone ? "done" : ""}`}>
            <span className="num">
              <i className="ti ti-check"></i>
              <span className="num-text">1</span>
            </span>
            <span className="lbl">Tu perfil</span>
          </div>
          <div className={`ob-mstep ${step === 2 ? "active" : ""}`}>
            <span className="num">
              <i className="ti ti-check"></i>
              <span className="num-text">2</span>
            </span>
            <span className="lbl">Mercado Pago</span>
          </div>
        </div>
      </div>

      <div className="ob-shell">
        {/* Desktop sidebar */}
        <aside className="ob-side">
          <Link href="/" className="logo">
            cuerv<span className="logo-dot"></span>to
          </Link>

          <div className="stepper">
            <div className={`step-item ${step === 1 ? "active" : profileDone ? "done" : ""}`}>
              <span className="num">
                <i className="ti ti-check"></i>
                <span className="num-text">1</span>
              </span>
              <div className="info">
                <div className="title">Tu perfil</div>
                <div className="desc">Datos básicos y bio</div>
              </div>
            </div>
            <div className={`step-item ${step === 2 ? "active" : ""}`}>
              <span className="num">
                <i className="ti ti-check"></i>
                <span className="num-text">2</span>
              </span>
              <div className="info">
                <div className="title">Conectá Mercado Pago</div>
                <div className="desc">Para recibir tus ventas</div>
              </div>
            </div>
          </div>

          <div className="ob-side-foot">
            ¿Tenés dudas? Escribinos a <a href="mailto:hola@cuervito.app">hola@cuervito.app</a>{" "}
            o por <a href="#">WhatsApp</a>.
          </div>
        </aside>

        <main className="ob-content">{children}</main>
      </div>
    </>
  );
}
