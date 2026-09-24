/**
 * Precios de lista de AWS que usa la estimación de gastos.
 *
 * Verificados el 24/9/2026 por dos caminos independientes que dieron lo
 * mismo en todos los casos: la API pública de precios de AWS (los archivos
 * de oferta por región, publicados entre el 11 y el 18 de septiembre) y las
 * páginas de precios oficiales. Al lado de cada uno va el SKU de la oferta,
 * para poder volver a chequearlo.
 *
 * Son precios del primer escalón y SIN capa gratuita, a propósito:
 *
 * · Los escalones más baratos de Rekognition empiezan en un millón de
 *   imágenes por mes y por grupo, y el de S3 en 50 TB. Con volúmenes así, esto
 *   es un tope superior y no una subestimación.
 *
 * · Las franquicias gratuitas (100 GB de salida por mes, 1 TB de CloudFront)
 *   son POR CUENTA, y la cuenta de AWS se comparte con otro proyecto. No hay
 *   forma de saber cuánto de la franquicia le toca a encontrate, así que no se
 *   descuenta nada y se dice.
 *
 * Si AWS cambia un precio, se cambia acá y en PRECIOS_VERIFICADOS.
 */

export const PRECIOS_VERIFICADOS = "2026-09-24";
export const REGION_PRECIOS = "us-east-2";

export const PRECIOS = {
  /** DetectText, grupo 2 de Rekognition. SKU 5ZBYHRPJ58A4NZXW. Por imagen. */
  rekognitionTexto: 0.001,
  /** IndexFaces, grupo 1. SKU 77WRAZ4KWANUQHBD, compartido con la búsqueda. Por imagen. */
  rekognitionIndexado: 0.001,
  /** SearchFacesByImage, grupo 1, mismo SKU que IndexFaces. Por imagen. */
  rekognitionBusqueda: 0.001,
  /** Caras guardadas en colecciones. SKU Z4KKQPSY98C7ADB2. Por cara y por mes, prorrateado. */
  rekognitionCaras: 0.00001,
  /** S3 Standard, primeros 50 TB. SKU YPGKVRB2EKTVDJDT. Por GB-mes. */
  s3Almacenamiento: 0.023,
  /** PUT, COPY, POST y LIST. SKU GJKK9PMSTKPNGZS9. Por cada 1.000 pedidos. */
  s3Put: 0.005,
  /** GET y el resto. SKU DJEKB32FV4HNZJZY. Por cada 1.000 pedidos. */
  s3Get: 0.0004,
  /** Salida de us-east-2 a internet, primeros 10 TB. SKU 36H7S3NU9B7S3UT5. Por GB. */
  salidaInternet: 0.09,
  /**
   * Transfer Acceleration, entrada por bordes fuera de EE. UU., Europa y
   * Japón, que es por donde entra una subida desde Argentina. SKU
   * 5274GX2M9MDPHWVK. Por GB, ADEMÁS de la entrada normal (que es gratis).
   */
  aceleracionEntrada: 0.08,
  /**
   * Transfer Acceleration, salida por cualquier borde. SKUs SS2T6PKCQV6JUTFM y
   * M3RMABM2MPYQ8WDG. Por GB, ADEMÁS de los 0,09 de la salida normal.
   */
  aceleracionSalida: 0.04,
  /** Cada consulta a la API de Cost Explorer, página por página. SKU BX68HKNBJP73AFBV. */
  costExplorerPedido: 0.01,
} as const;

/**
 * Cuánto pesan la vista previa, la limpia y la miniatura juntas, como
 * fracción del original. Medido el 24/9/2026 sobre 80 fotos reales leyendo
 * el tamaño de cada objeto: 7,98 % en las procesadas antes del cambio de marca
 * de agua del 15/9 y 8,20 % en las de después. Se usa el valor de ahora.
 */
export const DERIVADOS_SOBRE_ORIGINAL = 0.082;

/** AWS factura el GB como 2^30 bytes. */
export const BYTES_POR_GB = 1_073_741_824;
