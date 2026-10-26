import { COMISION } from "~/lib/producto";

/**
 * Lo que dicen las tres guías de Ayuda.
 *
 * Son datos y no JSX para que se lean de corrido y se corrijan sin tocar el
 * diálogo. Los números que también están en otro lado —la comisión, los
 * topes— salen de donde viven, no se copian: una guía que dice 10% cuando se
 * cobra otra cosa es peor que ninguna.
 */

export type GuiaId = "subir" | "reconocimiento" | "pagos";

export type Seccion = {
  titulo: string;
  texto?: string;
  pasos?: { titulo: string; texto: string }[];
  lista?: string[];
  tip?: string;
};

export type Guia = {
  id: GuiaId;
  titulo: string;
  /** Para los botones de anterior y siguiente. */
  corto: string;
  /** El resumen de la tarjeta. */
  resumen: string;
  /** La primera línea del diálogo: de qué va, en una. */
  lede: string;
  secciones: Seccion[];
};

export const GUIAS: Guia[] = [
  {
    id: "subir",
    titulo: "Subir un evento",
    corto: "Subir un evento",
    resumen: "De crear el evento a publicarlo, con los tamaños y formatos que conviene usar.",
    lede:
      "Un evento es una carpeta de fotos con un precio y un link. Se arma en cinco pasos y la mayoría se hacen una sola vez.",
    secciones: [
      {
        titulo: "Del evento al link",
        pasos: [
          {
            titulo: "Creá el evento",
            texto:
              "Desde «Nuevo evento»: nombre, fecha, lugar, disciplina y el precio por foto. Todo se puede cambiar después, también el precio; las ventas ya hechas no se tocan.",
          },
          {
            titulo: "Exportá las fotos",
            texto:
              "JPG, PNG o WebP, de hasta 30 MB cada una. Exportá a tamaño completo y buena calidad: el original es lo que se lleva el atleta cuando compra. La marca de agua y las miniaturas de la tienda las hacemos nosotros.",
          },
          {
            titulo: "Soltá la carpeta",
            texto:
              "Arrastrá la carpeta entera al recuadro del evento, o tocá para elegir. Mientras suben, no cierres la pestaña. Cuando terminan de subir, el resto sigue solo aunque te vayas.",
          },
          {
            titulo: "Poné una portada",
            texto:
              "Es lo primero que ve el atleta al abrir el link. Se cambia desde la foto grande de arriba del evento, con una imagen de hasta 8 MB. Los eventos sin portada venden bastante menos.",
          },
          {
            titulo: "Publicá y compartí",
            texto:
              "«Publicar evento» genera el link público. Copialo desde ahí mismo y mandalo a los grupos de la carrera, al organizador y a tus redes: publicar sin repartir el link no vende nada.",
          },
        ],
      },
      {
        titulo: "Mientras se procesa",
        texto:
          "Las fotos van apareciendo en la tienda a medida que se procesan, y el reconocimiento corre detrás. No hace falta esperar a que termine para publicar: el que entra ve las que ya están, y las demás se suman solas.",
        tip: "Si otro fotógrafo cubre el mismo evento, invitalo desde la solapa Equipo. Sube sus fotos al mismo evento y a la misma tienda, y el atleta encuentra las de todos juntas.",
      },
    ],
  },
  {
    id: "reconocimiento",
    titulo: "Cómo funciona el reconocimiento",
    corto: "Reconocimiento",
    resumen: "Qué detectamos, por qué a veces falla y cómo mejorar los resultados.",
    lede:
      "Cada foto que subís se mira sola: buscamos caras y números de dorsal, y con eso el atleta se encuentra en segundos.",
    secciones: [
      {
        titulo: "Qué detectamos",
        lista: [
          "Caras. El atleta se saca una selfie en la tienda y aparecen las fotos donde está. La selfie se usa para buscar y se descarta: no la guardamos.",
          "Dorsales. Leemos el número de la pechera, la camiseta o el casco, y el atleta también puede buscar escribiéndolo.",
          "Todo corre al subir, sin que configures nada. Lleva cerca de un minuto cada 200 fotos.",
        ],
      },
      {
        titulo: "Por qué a veces no encuentra una foto",
        lista: [
          "La cara está de perfil, tapada, muy chica o a contraluz. Sin una cara reconocible, la foto no aparece en la búsqueda por selfie, pero sigue en la galería y se puede encontrar por dorsal.",
          "El dorsal está doblado, tapado por un brazo o con sombra, y se lee mal o no se lee.",
          "La foto todavía se está procesando. En el evento, «Buscables» dice cuántas ya se pueden encontrar.",
        ],
        tip: "Si en las primeras diez fotos no aparece ningún número, la lectura de dorsales se apaga sola para ese evento: pasa en trail, ciclismo o entrenamientos. La búsqueda por cara sigue igual.",
      },
      {
        titulo: "Cómo mejorar los resultados",
        lista: [
          "Exportá a buen tamaño y sin recortar de más: una cara de pocos píxeles no se reconoce.",
          "Priorizá las tomas de frente y tres cuartos; las de espalda se venden menos y no se encuentran por cara.",
          "Al pasar el mouse por una foto en el evento ves cuántas caras se indexaron. Un cero ahí explica por qué nadie la encuentra.",
          "Si una foto quedó sin reconocer por un error de subida, escribinos y la mandamos a procesar de nuevo.",
        ],
      },
    ],
  },
  {
    id: "pagos",
    titulo: "Métodos de pago",
    corto: "Métodos de pago",
    resumen: "Cómo conectás tu cuenta, cuándo entra la plata y qué comisión se descuenta.",
    lede:
      "Cobrás en tu cuenta de Mercado Pago, en el momento en que el atleta paga. Nosotros nunca tenemos tu plata.",
    secciones: [
      {
        titulo: "Conectar Mercado Pago",
        pasos: [
          {
            titulo: "Andá a Métodos de pago",
            texto:
              "En el menú del panel. Tocá «Conectar Mercado Pago» y entrá con tu cuenta: es una vez sola, y se puede desconectar cuando quieras.",
          },
          {
            titulo: "Sin Mercado Pago no hay venta",
            texto:
              "El atleta encuentra sus fotos, pero no las puede comprar porque no hay dónde depositarte. Si tenés eventos publicados, conectalo antes de repartir el link.",
          },
        ],
      },
      {
        titulo: "Cuándo entra la plata y cuánto",
        lista: [
          `El pago entra directo a tu Mercado Pago en el momento de la venta. En la misma operación se descuenta el ${COMISION.conReconocimiento}% de encontrate; no hay retiros, mínimos ni plazos.`,
          "En la solapa Precio de cada evento ves cuánto te queda por foto con la comisión ya descontada, y podés cargar códigos de descuento o descuentos por cantidad.",
          "En Ventas está cada compra con su comprador, y desde ahí se le reenvía el mail de descarga si no le llegó.",
        ],
      },
      {
        titulo: "Qué recibe el atleta",
        texto:
          "Compra con su email, sin crearse una cuenta, y le llega un mail con el link para bajar sus fotos sin marca de agua. El link dura 30 días.",
        tip: "Si cubrís el evento con otros fotógrafos, todas las ventas entran en tu Mercado Pago, también las de sus fotos. Lo que le corresponde a cada uno queda anotado en la solapa Equipo, y se lo pasás vos.",
      },
    ],
  },
];
