import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y Condiciones · cuervito",
  description:
    "Términos y condiciones de uso de cuervito, plataforma de venta de fotos deportivas.",
};

const TOC = [
  { id: "capacidad", label: "Capacidad" },
  { id: "modificaciones", label: "Modificaciones" },
  { id: "servicio", label: "Descripción del servicio" },
  { id: "registro", label: "Registro y cuentas" },
  { id: "planes", label: "Planes y tarifas" },
  { id: "pagos", label: "Pagos y cobros" },
  { id: "contenido", label: "Contenido y propiedad intelectual" },
  { id: "marcas-agua", label: "Marcas de agua" },
  { id: "reconocimiento", label: "Reconocimiento facial" },
  { id: "privacidad", label: "Privacidad" },
  { id: "conducta", label: "Conducta prohibida" },
  { id: "responsabilidad", label: "Responsabilidad" },
  { id: "limitacion", label: "Limitación de responsabilidad" },
  { id: "terminacion", label: "Terminación" },
  { id: "indemnizacion", label: "Indemnización" },
  { id: "fuerza-mayor", label: "Fuerza mayor" },
  { id: "jurisdiccion", label: "Jurisdicción" },
  { id: "contacto", label: "Contacto" },
];

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="legal-placeholder">{children}</span>;
}

export default function TerminosPage() {
  return (
    <>
      <div className="legal-eyebrow">Documentos legales</div>
      <h1>Términos y Condiciones de Uso</h1>
      <div className="legal-updated">Última actualización: marzo 2026</div>

      <p>
        Los presentes Términos y Condiciones Generales de Uso (en adelante, los{" "}
        <strong>&ldquo;Términos y Condiciones&rdquo;</strong>) regulan el acceso
        y utilización, por parte del Usuario, de la página web{" "}
        <strong>cuervito.app</strong> (en adelante, &ldquo;la Plataforma&rdquo;),
        así como la compra de productos y servicios a través de la misma.
      </p>

      <p>
        La Plataforma es operada por{" "}
        <Placeholder>{"{{RAZON_SOCIAL}}"}</Placeholder>, con domicilio en{" "}
        <Placeholder>{"{{DOMICILIO}}"}</Placeholder> e identificación tributaria{" "}
        <Placeholder>{"{{CUIT}}"}</Placeholder> (en adelante, &ldquo;los
        Administradores&rdquo;).
      </p>

      <div className="legal-callout">
        <strong>Aceptación obligatoria.</strong> Cualquier persona que no acepte
        estos Términos y Condiciones, los cuales tienen carácter de obligatorios
        y vinculantes, debe abstenerse de utilizar la Plataforma. Al registrarse
        en cuervito, el Usuario declara haber leído, comprendido y aceptado
        estos Términos.
      </div>

      <div className="legal-toc">
        <div className="legal-toc-title">Índice</div>
        <ol>
          {TOC.map((t, i) => (
            <li key={t.id}>
              {String(i + 1).padStart(2, "0")}. <a href={`#${t.id}`}>{t.label}</a>
            </li>
          ))}
        </ol>
      </div>

      <h2 id="capacidad">1. Capacidad</h2>
      <p>
        Los servicios de cuervito están disponibles únicamente para personas que
        tengan capacidad legal para contratar según la legislación vigente. No
        podrán utilizar los servicios las personas que no tengan dicha
        capacidad, los menores de edad sin autorización de sus representantes
        legales, ni los Usuarios que hayan sido suspendidos temporalmente o
        inhabilitados definitivamente por los Administradores.
      </p>
      <p>
        Al registrarse, el Usuario declara bajo juramento que tiene capacidad
        legal para contratar y que toda la información proporcionada es veraz,
        completa y actualizada.
      </p>

      <h2 id="modificaciones">2. Modificaciones</h2>
      <p>
        Los Administradores podrán modificar los Términos y Condiciones en
        cualquier momento, haciendo públicos en la Plataforma los términos
        modificados. Dichas modificaciones entrarán en vigencia a los 10 (diez)
        días de su publicación. Los Administradores notificarán a los Usuarios
        sobre cambios sustanciales por correo electrónico o mediante un aviso
        destacado en la Plataforma.
      </p>
      <p>
        El uso continuado de la Plataforma tras la entrada en vigencia de las
        modificaciones constituye la aceptación tácita de los nuevos Términos y
        Condiciones.
      </p>

      <h2 id="servicio">3. Descripción del servicio</h2>
      <p>
        cuervito es una plataforma en línea que conecta fotógrafos y creadores
        de contenido (en adelante, <strong>&ldquo;Vendedores&rdquo;</strong>)
        con compradores de fotos y videos de eventos deportivos, maratones,
        carreras, fiestas y otros eventos (en adelante,{" "}
        <strong>&ldquo;Compradores&rdquo;</strong>). Vendedores y Compradores
        serán denominados conjuntamente como <strong>&ldquo;Usuarios&rdquo;</strong>.
      </p>
      <p>
        cuervito actúa como intermediario entre Vendedores y Compradores,
        facilitando la publicación, búsqueda y compra de contenido. cuervito no
        es parte en las transacciones entre Vendedores y Compradores y no asume
        responsabilidad sobre la calidad, legalidad ni veracidad del contenido
        publicado por los Vendedores.
      </p>

      <h2 id="registro">4. Registro y cuentas de usuario</h2>
      <p>
        Para utilizar ciertas funcionalidades de cuervito, el Usuario deberá
        crear una cuenta. El registro puede realizarse mediante una cuenta de
        Google o con correo electrónico y contraseña.
      </p>
      <ul>
        <li>
          El Usuario es responsable de mantener la confidencialidad y seguridad
          de su cuenta y contraseña.
        </li>
        <li>
          El Usuario deberá proporcionar información veraz, completa y
          actualizada al momento del registro.
        </li>
        <li>
          El Usuario no deberá compartir su cuenta ni permitir el acceso a
          terceros no autorizados. Los Administradores no serán responsables de
          los perjuicios derivados del uso no autorizado de la cuenta.
        </li>
        <li>
          La cuenta es <strong>personal, única e intransferible</strong>. En
          caso de detectarse cuentas duplicadas o vinculadas a un mismo Usuario,
          los Administradores podrán cancelar, suspender o inhabilitar dichas
          cuentas.
        </li>
      </ul>

      <h2 id="planes">5. Planes y tarifas</h2>
      <ul>
        <li>Sin costo mensual de suscripción.</li>
        <li>
          <strong>Comisión del 10%</strong> por cada venta realizada.
        </li>
        <li>100 GB de almacenamiento por fotógrafo.</li>
        <li>Hasta 10.000 reconocimientos faciales por mes.</li>
      </ul>
      <p>
        Los precios podrán estar sujetos a cambios. Los Administradores
        notificarán a los Usuarios sobre cualquier modificación con una
        antelación mínima razonable. Los precios no incluyen impuestos, tasas o
        tributos que pudieran resultar aplicables según la jurisdicción del
        Usuario, los cuales serán a exclusivo cargo del Usuario.
      </p>

      <h2 id="pagos">6. Pagos y cobros</h2>
      <ul>
        <li>
          <strong>Compradores:</strong> los pagos se procesan a través de{" "}
          <strong>Mercado Pago</strong>, único procesador habilitado actualmente
          en cuervito.
        </li>
        <li>
          <strong>Vendedores:</strong> los pagos a Vendedores se acreditan
          directamente en su cuenta de Mercado Pago a través del modelo
          marketplace. El Vendedor deberá vincular su cuenta de MP para recibir
          los pagos.
        </li>
        <li>
          <strong>Seguridad:</strong> cuervito no almacena datos de tarjetas de
          crédito, débito ni información bancaria. Toda la información de pago
          es gestionada directamente por Mercado Pago de acuerdo con sus
          propias políticas de seguridad y privacidad.
        </li>
        <li>
          <strong>Acreditación:</strong> los plazos de acreditación dependen de
          Mercado Pago y sus regulaciones. cuervito no se responsabiliza por
          demoras causadas por Mercado Pago o entidades bancarias.
        </li>
        <li>
          <strong>Moneda:</strong> los precios se expresan en pesos argentinos
          (ARS).
        </li>
      </ul>

      <h2 id="contenido">7. Contenido y propiedad intelectual</h2>
      <ul>
        <li>
          <strong>Derechos del Vendedor:</strong> los Vendedores conservan
          todos los derechos de propiedad intelectual sobre el contenido que
          suben a cuervito. Los Administradores no reclaman titularidad alguna
          sobre dicho contenido.
        </li>
        <li>
          <strong>Licencia a cuervito:</strong> al subir contenido a la
          Plataforma, los Vendedores otorgan a cuervito una licencia no
          exclusiva, gratuita, mundial y por el tiempo que el contenido
          permanezca en la Plataforma, para mostrar, aplicar marcas de agua
          automáticas, procesar, almacenar, reproducir y distribuir dicho
          contenido dentro de la Plataforma, con el exclusivo fin de prestar el
          servicio.
        </li>
        <li>
          <strong>Licencia al Comprador:</strong> al adquirir contenido, los
          Compradores reciben una licencia de uso personal, no exclusiva, no
          transferible. El Comprador no podrá revender, sublicenciar ni
          distribuir comercialmente el contenido adquirido sin autorización
          expresa del Vendedor.
        </li>
        <li>
          <strong>Contenido prohibido:</strong> el Vendedor garantiza que el
          contenido subido no infringe derechos de propiedad intelectual de
          terceros, no contiene material ilegal, difamatorio, obsceno ni que
          viole la legislación aplicable. Los Administradores se reservan el
          derecho de remover cualquier contenido que infrinja esta disposición.
        </li>
      </ul>

      <h2 id="marcas-agua">8. Marcas de agua</h2>
      <p>
        cuervito aplica marcas de agua automáticas al contenido subido por los
        Vendedores para proteger sus derechos de propiedad intelectual y evitar
        el uso no autorizado del material. Está estrictamente prohibido
        intentar remover, alterar, evadir o eludir dichas marcas de agua. La
        violación de esta disposición podrá dar lugar a la suspensión o
        inhabilitación de la cuenta del Usuario infractor, sin perjuicio de las
        acciones legales que pudieran corresponder.
      </p>

      <h2 id="reconocimiento">9. Búsqueda por reconocimiento facial</h2>
      <p>
        cuervito ofrece una función de búsqueda por reconocimiento facial para
        ayudar a los Compradores a encontrar sus fotos en los álbumes de
        eventos. Las selfies o imágenes faciales enviadas por el Usuario para
        este fin son procesadas de forma temporal y automática, y no se
        almacenan de forma permanente una vez completada la búsqueda.
      </p>
      <p>
        Los datos biométricos generados durante el proceso de búsqueda no se
        comparten con terceros, no se utilizan con fines comerciales ni para
        ningún otro propósito distinto al de la búsqueda de contenido dentro de
        la Plataforma. Al utilizar esta funcionalidad, el Usuario presta su
        consentimiento para el procesamiento temporal de su imagen facial.
      </p>

      <h2 id="privacidad">10. Privacidad y datos personales</h2>
      <p>
        Los Administradores se comprometen a proteger la privacidad de los
        datos personales de los Usuarios. La recopilación, almacenamiento y
        tratamiento de datos personales se rige por la{" "}
        <a href="/privacidad">Política de Privacidad</a> publicada en la
        Plataforma, la cual forma parte integrante de los presentes Términos y
        Condiciones.
      </p>

      <h2 id="conducta">11. Conducta prohibida</h2>
      <p>Al utilizar cuervito, el Usuario se compromete a no:</p>
      <ul>
        <li>
          Subir contenido ilegal, difamatorio, obsceno, discriminatorio o que
          infrinja derechos de terceros.
        </li>
        <li>
          Realizar actividades fraudulentas, engañosas o que perjudiquen a
          otros Usuarios o a la Plataforma.
        </li>
        <li>
          Intentar realizar ingeniería inversa, descompilar o desensamblar
          cualquier parte de la Plataforma.
        </li>
        <li>
          Utilizar bots, scrapers u otras herramientas automatizadas para
          extraer datos de la Plataforma.
        </li>
        <li>
          Interferir con el funcionamiento normal de la Plataforma o sus
          sistemas de seguridad.
        </li>
        <li>Crear cuentas falsas o suplantar la identidad de otros Usuarios.</li>
        <li>
          Eludir, desactivar o interferir con las marcas de agua u otras
          medidas de protección del contenido.
        </li>
        <li>
          Utilizar la Plataforma para distribuir spam, malware o cualquier otro
          material no solicitado.
        </li>
      </ul>

      <h2 id="responsabilidad">12. Responsabilidad del Usuario</h2>
      <p>
        El Usuario es el único responsable de la utilización que haga de la
        Plataforma y del contenido que publique en la misma. El Usuario se
        obliga a mantener indemnes a los Administradores frente a cualquier
        reclamo, demanda o daño que pudiera derivarse del incumplimiento de los
        presentes Términos y Condiciones o de la legislación aplicable por
        parte del Usuario.
      </p>

      <h2 id="limitacion">13. Limitación de responsabilidad</h2>
      <p>
        cuervito actúa como plataforma intermediaria entre Vendedores y
        Compradores. En consecuencia, los Administradores no se hacen
        responsables por:
      </p>
      <ul>
        <li>
          La calidad, precisión, legalidad o veracidad del contenido subido por
          los Vendedores.
        </li>
        <li>Disputas entre Usuarios.</li>
        <li>
          Daños directos, indirectos, incidentales, especiales o consecuentes
          derivados del uso o la imposibilidad de uso de la Plataforma.
        </li>
        <li>La disponibilidad ininterrumpida del servicio.</li>
        <li>
          Pérdidas o daños causados por fallos técnicos, virus o ataques
          informáticos.
        </li>
        <li>Las acciones u omisiones de Mercado Pago.</li>
      </ul>
      <p>
        La responsabilidad total de los Administradores, en caso de proceder,
        no excederá el monto efectivamente abonado por el Usuario en los 12
        (doce) meses anteriores al evento que dé lugar al reclamo.
      </p>

      <h2 id="terminacion">14. Terminación y suspensión</h2>
      <ul>
        <li>
          <strong>Por el Usuario:</strong> el Usuario podrá eliminar su cuenta
          en cualquier momento desde la configuración de su perfil o
          contactando al equipo de soporte en{" "}
          <a href="mailto:hola@cuervito.app">hola@cuervito.app</a>. La
          eliminación de la cuenta no exime al Usuario de las obligaciones
          pendientes al momento de la cancelación.
        </li>
        <li>
          <strong>Por los Administradores:</strong> los Administradores se
          reservan el derecho de suspender, restringir o terminar cuentas que
          violen estos Términos y Condiciones, sin previo aviso y sin obligación
          de reembolso.
        </li>
      </ul>

      <h2 id="indemnizacion">15. Indemnización</h2>
      <p>
        El Usuario se obliga a indemnizar y mantener indemnes a los
        Administradores, sus directores, empleados, agentes y colaboradores
        frente a cualquier reclamo, pérdida, gasto o daño (incluyendo honorarios
        de abogados) derivado de: (a) el uso que el Usuario haga de la
        Plataforma; (b) la violación de los presentes Términos y Condiciones;
        (c) la infracción de derechos de terceros, incluyendo derechos de
        propiedad intelectual; o (d) cualquier contenido subido por el Usuario
        a la Plataforma.
      </p>

      <h2 id="fuerza-mayor">16. Fuerza mayor</h2>
      <p>
        Los Administradores no serán responsables por el incumplimiento o
        cumplimiento tardío de sus obligaciones cuando dicho incumplimiento se
        deba a causas de fuerza mayor, caso fortuito, o cualquier otra causa
        ajena a su voluntad, incluyendo pero no limitándose a: desastres
        naturales, conflictos bélicos, huelgas, interrupciones de servicios de
        telecomunicaciones o de Internet, fallas de servidores de terceros,
        actos de gobierno o resoluciones judiciales.
      </p>

      <h2 id="jurisdiccion">17. Jurisdicción y ley aplicable</h2>
      <p>
        Los presentes Términos y Condiciones se rigen por las leyes de la{" "}
        <strong>República Argentina</strong>. Cualquier controversia que se
        suscite entre el Usuario y los Administradores con relación a la
        interpretación, validez, alcance o cumplimiento de los presentes
        Términos y Condiciones será sometida a la jurisdicción de los Tribunales
        Nacionales Ordinarios con asiento en{" "}
        <Placeholder>{"{{JURISDICCION_CIUDAD}}"}</Placeholder>, República
        Argentina, renunciando el Usuario a cualquier otro fuero o jurisdicción
        que pudiera corresponderle.
      </p>

      <h2 id="contacto">18. Contacto</h2>
      <p>
        Para cualquier consulta, reclamo o comunicación relacionada con los
        presentes Términos y Condiciones, el Usuario podrá dirigirse a los
        Administradores mediante correo electrónico a{" "}
        <a href="mailto:hola@cuervito.app">hola@cuervito.app</a>.
      </p>
    </>
  );
}
