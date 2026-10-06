import "server-only";

import { env } from "~/env";

/**
 * La dirección de la app, sin la barra final. En un módulo propio para que
 * las piezas del diseño, los titulares y las imágenes la usen sin importarse
 * entre sí en círculo.
 */
export const BASE = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
