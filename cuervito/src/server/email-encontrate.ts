import "server-only";

/* ============================================================================
 * Los mails de encontrate.app — la puerta de entrada.
 * ----------------------------------------------------------------------------
 * Acá vivían las plantillas y sus piezas (armar, boton, titulo…). Con el
 * rediseño, las piezas están en correos/diseno.ts, los mails de la cuenta en
 * correos/transaccionales.ts y las campañas en correos/plantillas.ts. Este
 * archivo queda para que mailsDe() y los que importaban de acá no cambien:
 * dos juegos de piezas son dos estilos que se separan solos, así que el viejo
 * se borró en vez de quedar al lado.
 * ========================================================================= */

export { BASE } from "./correos/diseno";

export {
  collaboratorInviteHtml,
  deliveryEmailHtml,
  passwordResetEmailHtml,
  saleEmailBigBatchHtml,
  saleEmailSingleHtml,
  saleEmailSmallBatchHtml,
  welcomeEmailHtml,
  type CollaboratorInviteInput,
  type DeliveryEmailInput,
  type PasswordResetEmailInput,
  type WelcomeEmailInput,
} from "./correos/transaccionales";
