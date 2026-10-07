# Blog

Cada `.mdx` de esta carpeta es un post. El nombre del archivo es la dirección:
`cuanto-cobrar.mdx` se publica en `/blog/cuanto-cobrar`. Este README no se
publica: sólo se leen los `.mdx`.

## Frontmatter

```yaml
---
titulo: "Cómo vender fotos de eventos deportivos"   # 15 a 70 caracteres
descripcion: "Lo que aparece en Google debajo del título."  # 70 a 160
categoria: fotografos        # fotografos | atletas | ayuda
publicado: 2026-10-07
actualizado: 2026-11-02      # opcional: cuando cambia algo importante
borrador: true               # se ve en desarrollo, no en producción
---
```

Si algo está mal —un campo que falta, un título largo, un archivo que se llama
igual que una sección (`fotografos.mdx`)— el build falla y dice qué archivo.

## Componentes

- `<Llamado para="fotografos" />` o `para="atletas"`: botón a crear cuenta o a
  buscar fotos. **No hace falta al final**: la página ya pone uno según la
  sección. Usalo en el medio si el post es largo.
- `<Nota titulo="Ojo">texto</Nota>`: un recuadro para lo que no puede perderse.
- `<Comision />` y `<Comision sin />`: la comisión vigente. Nunca escribas el
  porcentaje a mano: si cambia, cambia acá sola.

### Ilustraciones

Animadas al entrar en pantalla; sin JavaScript o con «reducir movimiento» se
ven en su estado final. Van en una línea sola, con una línea en blanco arriba
y abajo.

- `<Buscarse modo="dorsal" />` o `modo="selfie"`: de 2.162 fotos a las 4 tuyas.
- `<PuntosDeCobertura />`: el recorrido de una carrera y dónde pararse.
- `<DivisionCobro />` (o `<DivisionCobro sin />`): cómo se parte un pago.
- `<Pasos de="venta" />` o `de="atleta"`: el recorrido en cuatro pasos.
- `<Calculadora />`: la cuenta de precio con los números de cada uno.

No usamos fotos generadas: en una plataforma que vende fotos reales, una foto
inventada es lo primero que se nota. Las ilustraciones son siluetas y
diagramas, con el naranja una sola vez por pieza.

El MDX no corre JavaScript: nada de `{expresiones}` ni `export`.

## Antes de publicar

1. Leelo en `npm run dev`, en `/blog/<nombre>`.
2. Sacá `borrador: true`.
3. Links internos con `/` adelante: `[buscar fotos](/eventos)`.
4. Sin métricas reales del negocio ni nombres de fotógrafos sin permiso: el
   repo es público y el post queda en el historial aunque después se borre.

Publicar = commit + deploy. El post entra solo al sitemap, a `/llms.txt` y a
`/llms-full.txt`.
