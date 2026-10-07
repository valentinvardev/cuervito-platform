/**
 * Lo que el producto promete, en un solo lugar.
 *
 * Lo leen la landing, el blog y /llms.txt, que es lo que leen los buscadores
 * con IA. Si la comisión cambia y una de las tres copias queda vieja, un
 * agente le contesta a un fotógrafo con el precio equivocado, y lo contesta
 * con toda seguridad.
 *
 * La comisión que se COBRA no sale de acá: la decide PLATFORM_FEE_PERCENT, o
 * la del evento. Esto es lo que se dice. Si se cambia una, se cambia la otra.
 */

export const COMISION = {
  /** Por venta, con reconocimiento de cara y número. */
  conReconocimiento: 10,
  /** Sólo la galería, sin búsqueda por cara ni número. */
  sinReconocimiento: 5,
} as const;

export const INCLUIDO = [
  "100 GB de almacenamiento",
  "Eventos y fotos ilimitados",
  "Reconocimiento de cara y número",
  "Marca de agua automática",
  "Tu página con dominio propio",
  "Códigos de descuento",
  "Descuentos por cantidad",
  "Colaboradores con comisión propia",
  "Entrega y descarga automáticas",
  "Soporte por WhatsApp las 24 horas",
];

export const PREGUNTAS = [
  {
    p: "¿Cuándo cobro?",
    r: `En el momento de la venta. El pago del atleta entra directo a tu cuenta de Mercado Pago y nosotros retenemos el ${COMISION.conReconocimiento}% en la misma operación. No hay retiros ni plazos: nunca tenemos tu plata.`,
  },
  {
    p: "¿El atleta tiene que crearse una cuenta?",
    r: "No. Compra con su email y descarga con un link, sin registrarse. Cada paso que le sacás al comprador es plata que no perdés.",
  },
  {
    p: "¿Sirve si en mi deporte no hay dorsal?",
    r: "Sí. El reconocimiento facial funciona igual, y el atleta también puede recorrer la galería completa y filtrar a mano.",
  },
  {
    p: "¿Qué pasa con la selfie que sube el atleta?",
    r: "Se usa para buscar y se descarta. No la guardamos: no va a nuestro storage ni a la base de datos.",
  },
  {
    p: "¿A quién le escribo si algo falla?",
    r: "A nosotros, por WhatsApp, a la hora que sea. Las carreras arrancan a las 7 de la mañana y terminan de noche, así que el soporte atiende las 24 horas.",
  },
];
