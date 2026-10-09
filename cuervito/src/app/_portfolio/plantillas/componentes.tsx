import type { Viewport } from "../tipos";
import { FotofinishPlantilla } from "./FotofinishPlantilla";
import { HalcyonPlantilla } from "./HalcyonPlantilla";
import { MeridianPlantilla } from "./MeridianPlantilla";
import { PodioPlantilla } from "./PodioPlantilla";
import type { IdPlantilla } from "./registro";
import { SenderoPlantilla } from "./SenderoPlantilla";
import { VernissagePlantilla } from "./VernissagePlantilla";

/**
 * El componente que dibuja cada plantilla. Importados directo y no con
 * `dynamic(..., { ssr: false })` como en photo-saas: allá el sitio público se
 * armaba sólo en el navegador y Google recibía una página vacía. Acá se
 * generan en el servidor como cualquier otra página.
 */
export const COMPONENTES: Record<IdPlantilla, React.ComponentType<{ viewport: Viewport }>> = {
  halcyon: HalcyonPlantilla,
  meridian: MeridianPlantilla,
  vernissage: VernissagePlantilla,
  podio: PodioPlantilla,
  fotofinish: FotofinishPlantilla,
  sendero: SenderoPlantilla,
};
