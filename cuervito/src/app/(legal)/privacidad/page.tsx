import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad · cuervito",
  description:
    "Cómo cuervito recopila, usa y protege tus datos personales.",
};

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="legal-placeholder">{children}</span>;
}

export default function PrivacidadPage() {
  return (
    <>
      <div className="legal-eyebrow">Documentos legales</div>
      <h1>Política de Privacidad</h1>
      <div className="legal-updated">Última actualización: marzo 2026</div>

      <p>
        Esta Política de Privacidad describe cómo cuervito recopila, usa,
        comparte y protege tu información personal cuando utilizás la
        plataforma <strong>cuervito.app</strong>. Al usar nuestros servicios,
        aceptás esta política.
      </p>

      <h2 id="quienes">1. ¿Quiénes somos?</h2>
      <p>
        cuervito es una plataforma en línea que conecta fotógrafos y creadores
        de contenido con compradores de fotos y videos de eventos deportivos,
        maratones, carreras, fiestas y otros eventos en Latinoamérica.
        Operamos en <strong>cuervito.app</strong>.
      </p>
      <p>
        La Plataforma es operada por{" "}
        <Placeholder>{"{{RAZON_SOCIAL}}"}</Placeholder>, con domicilio en{" "}
        <Placeholder>{"{{DOMICILIO}}"}</Placeholder> e identificación tributaria{" "}
        <Placeholder>{"{{CUIT}}"}</Placeholder>.
      </p>

      <h2 id="recopilamos">2. Información que recopilamos</h2>
      <ul>
        <li>
          <strong>Datos de cuenta:</strong> nombre, dirección de correo
          electrónico y foto de perfil cuando te registrás.
        </li>
        <li>
          <strong>Datos de pago:</strong> para procesar pagos usamos Mercado
          Pago. cuervito <strong>no almacena</strong> datos de tarjetas de
          crédito ni información bancaria — todo se gestiona del lado de
          Mercado Pago.
        </li>
        <li>
          <strong>Selfies para búsqueda facial:</strong> si utilizás la función
          de búsqueda por rostro, procesamos la selfie que subís para encontrar
          tus fotos en el álbum. Esta imagen se usa exclusivamente para ese
          fin y no se comparte con terceros.
        </li>
        <li>
          <strong>Fotos y videos:</strong> los fotógrafos suben contenido a la
          plataforma; los compradores pueden adquirirlo. cuervito almacena ese
          contenido para prestar el servicio.
        </li>
        <li>
          <strong>Datos de uso:</strong> dirección IP, tipo de dispositivo,
          navegador, páginas visitadas e interacciones dentro de la plataforma,
          con el fin de mejorar el servicio y detectar fraudes.
        </li>
      </ul>

      <h2 id="usamos">3. Cómo usamos tu información</h2>
      <ul>
        <li>Prestar y mejorar los servicios de cuervito.</li>
        <li>Procesar órdenes de compra y enviar comprobantes.</li>
        <li>
          Ejecutar la búsqueda de fotos por reconocimiento facial o número de
          dorsal.
        </li>
        <li>
          Enviarte notificaciones sobre tus pedidos y actividad en tu cuenta.
        </li>
        <li>Detectar y prevenir actividades fraudulentas o abusivas.</li>
        <li>Cumplir con obligaciones legales y regulatorias.</li>
      </ul>

      <h2 id="compartir">4. Compartir información con terceros</h2>
      <p>
        cuervito <strong>no vende ni alquila</strong> tu información personal.
        Compartimos datos únicamente con los siguientes proveedores de
        servicios y solo en la medida necesaria:
      </p>
      <ul>
        <li>
          <strong>Mercado Pago:</strong> para procesar pagos. Sus términos de
          privacidad aplican a la información que ingresás en sus plataformas.
        </li>
        <li>
          <strong>Amazon Web Services (AWS):</strong> para almacenamiento
          seguro de fotos, videos y datos de la plataforma. También usamos AWS
          Rekognition para la búsqueda por reconocimiento facial.
        </li>
        <li>
          <strong>Resend:</strong> para enviar correos transaccionales
          (bienvenida, comprobantes de compra, links de descarga).
        </li>
        <li>
          <strong>Autoridades:</strong> cuando sea requerido por ley o para
          proteger derechos, seguridad o propiedad de cuervito o sus usuarios.
        </li>
      </ul>

      <h2 id="biometricos">5. Datos biométricos y reconocimiento facial</h2>
      <p>
        La selfie que subís para búsqueda facial es procesada para generar un
        vector de comparación. <strong>No almacenamos tu imagen</strong> de
        forma permanente una vez completada la búsqueda. No utilizamos tus
        datos biométricos para ningún otro propósito ni los compartimos con
        terceros.
      </p>

      <div className="legal-callout">
        <strong>En claro:</strong> tu selfie sirve solo para encontrar tus
        fotos en el álbum del evento. Después de la búsqueda, el archivo se
        elimina automáticamente. El vector de cara puede quedar asociado a tu
        cuenta para repetir búsquedas futuras sin volver a subir selfie, pero
        nunca se exporta fuera de la plataforma.
      </div>

      <h2 id="retencion">6. Retención de datos</h2>
      <p>
        Conservamos tu información de cuenta mientras tu cuenta esté activa o
        sea necesario para prestarte el servicio. Las fotos y videos adquiridos
        por compradores se mantienen disponibles para descarga durante{" "}
        <strong>72 horas</strong> desde la confirmación de pago. Podés
        solicitar la eliminación de tu cuenta y tus datos en cualquier momento
        escribiendo a{" "}
        <a href="mailto:hola@cuervito.app">hola@cuervito.app</a>.
      </p>

      <h2 id="seguridad">7. Seguridad</h2>
      <p>
        Implementamos medidas técnicas y organizativas razonables para proteger
        tu información contra accesos no autorizados, pérdida o alteración. Las
        contraseñas se almacenan hasheadas con bcrypt; las conexiones a la
        plataforma usan HTTPS; los pagos pasan por Mercado Pago y nunca tocan
        nuestros servidores. Sin embargo, ningún sistema es 100% seguro y no
        podemos garantizar seguridad absoluta.
      </p>

      <h2 id="cookies">8. Cookies</h2>
      <p>
        Usamos cookies y tecnologías similares para mantener tu sesión activa,
        recordar preferencias y analizar el uso de la plataforma. Podés
        configurar tu navegador para rechazar cookies, aunque algunas
        funcionalidades pueden verse afectadas.
      </p>

      <h2 id="derechos">9. Tus derechos</h2>
      <p>Tenés derecho a:</p>
      <ul>
        <li>Acceder a la información personal que tenemos sobre vos.</li>
        <li>Rectificar datos incorrectos o incompletos.</li>
        <li>Solicitar la eliminación de tus datos personales.</li>
        <li>Oponerte al tratamiento de tus datos con fines de marketing.</li>
        <li>Solicitar la portabilidad de tus datos.</li>
      </ul>
      <p>
        Para ejercer cualquiera de estos derechos, escribinos a{" "}
        <a href="mailto:hola@cuervito.app">hola@cuervito.app</a>.
      </p>

      <h2 id="cambios">10. Cambios a esta política</h2>
      <p>
        Podemos actualizar esta política periódicamente. Te notificaremos sobre
        cambios significativos por correo electrónico o mediante un aviso en la
        plataforma. El uso continuado de cuervito tras dichos cambios implica
        tu aceptación.
      </p>

      <h2 id="contacto">11. Contacto</h2>
      <p>
        Si tenés preguntas sobre esta política, podés escribirnos a{" "}
        <a href="mailto:hola@cuervito.app">hola@cuervito.app</a>.
      </p>
    </>
  );
}
