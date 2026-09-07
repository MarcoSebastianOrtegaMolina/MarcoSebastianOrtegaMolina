# Chuleta de habilidades · Project Zomboid Build 42

Guía en español de una sola página para subir las 35 habilidades de Project Zomboid,
verificada contra la versión **42.20.4 estable** (rama estable desde el 29 de julio de 2026;
datos revisados el 7 de septiembre de 2026).

**Archivo:** [`guia-habilidades.html`](./guia-habilidades.html) — ábrelo directo en el navegador, no necesita servidor ni dependencias.

## Qué trae

- **La respuesta a "¿qué desarmo?"** — en B42 desarmar muebles ya no da XP por defecto, y viene la opción de sandbox exacta para revertirlo.
- **Réplica del panel de habilidades del juego** con los valores reales del personaje leídos de las capturas.
- **35 fichas**, una por habilidad: qué hacer exactamente, qué materiales necesitas, cuánta XP da y un tip.
- **Las dos curvas de XP** (normal y pasiva) — cuadran con los números que muestra el juego.
- **Multiplicadores**: libros, Fast Learner, Crafty, y por qué Fuerza y Estado físico son la excepción.
- Filtro por categoría, buscador, y checklist que se guarda en el navegador (`localStorage`).

## Sobre los sprites oficiales

Los iconos que trae la página hoy son vectores dibujados a mano, no los sprites del juego.

El entorno donde se generó esta guía tiene bloqueado el acceso de red a `pzwiki.net`,
`projectzomboid.fandom.com` y las demás wikis (la política de egress responde 403), así que
no fue posible descargar los PNG oficiales para incrustarlos.

El intercambio ya está preparado en el código. Al final de `guia-habilidades.html`:

```js
const SPRITES = {};
```

Llénalo con `{ idHabilidad: "ruta/al/sprite.png" }` y los sprites sustituyen a los vectores
automáticamente. Los ids son los del array `S` (`carpinteria`, `tallar`, `labrarpiedra`,
`mantenimiento`, …). Para que funcione dentro de un Artifact de Claude las imágenes tienen
que ir como data URI, porque la CSP bloquea imágenes externas; en un HTML local o en
GitHub Pages una ruta relativa o una URL normal funciona igual de bien.

## Fuentes

Historial de versiones y notas de parche de PZwiki y The Indie Stone, la guía de XP de
Build 42.20 de Steam Community, PZFans, Bamboo Gaming y la calculadora de XP de XGamingServer.
Los enlaces completos están en el pie de la propia guía.

Project Zomboid es propiedad de The Indie Stone. Guía hecha por fans, sin relación oficial con el estudio.
