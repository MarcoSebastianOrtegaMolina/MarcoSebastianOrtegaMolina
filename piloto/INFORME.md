# Informe del piloto técnico de la cabecera

Medido el 2026-11-12 (11:12 UTC) con chromium 156.0.8078.4 sin cabeza, en
https://github.com/MarcoSebastianOrtegaMolina/MarcoSebastianOrtegaMolina/tree/piloto-cabecera sin sesión iniciada. Todos los números salen de `_trabajo/capturas/medicion.json`
(la carpeta `_trabajo/` no se sube; se regenera con `node piloto/medir.cjs _trabajo/capturas`).

Cómo se mide la diferencia entre dos capturas: porcentaje de píxeles en los que algún canal cambia
más de 32/255. El JSON guarda también el porcentaje con umbral 8/255 y la diferencia media.
«GitHub» quiere decir: la imagen tal como la entrega y la monta github.com en la página de la rama,
pintada por ese Chromium. Lo local es el mismo SVG en una página propia, al mismo tamaño, con la
misma fracción de píxel y el mismo fondo.

## 1. Resultados

| Experimento | Resultado | Medida | Se comprueba con |
|---|---|---|---|
| 1. Fuentes embebidas | sí | GitHub contra local: 0 % de píxeles distintos (tope 1 %). Control con fuentes que no existen: 4,919 %; falla como debe. | `exp1` del JSON; `gh-exp1-*.png` y `local-exp1-*.png`; `piloto/assets/exp1-*.svg` |
| 2. Pestañas pegadas | sí, con la forma 2e | 2e: 0 px de hueco y 0 caídas en 4 de 4 casos. 2d: 2 de 4 (falla a 390 px). 2a, 2b y 2c: 0 de 4. | `exp2` del JSON; `gh-exp2-<forma>-<ancho>-<tema>.png` |
| 3. Tema claro y oscuro | sí | Oscuro carga `exp3-oscuro-v1.svg` sobre fondo #0d1117; claro carga `exp3-claro-v1.svg` sobre #ffffff. Igual a 390 px. GitHub sin sesión sigue la emulación (`data-color-mode="auto"`). | `exp3` del JSON; `gh-exp3-*.png`, `gh-pagina-*.png` |
| 4. Avatar animado | sí | Fidelidad del cuadro final: 0,008 % (oscuro) y 0,007 % (claro). En GitHub, 0,4 s contra 8,5 s: 32 % y 30,942 % (la animación corre); final contra local: 0,013 % y 0,003 %. Con reducir movimiento, a 0,4 s: 0,022 % y 0,01 % contra el final. Peso 374,8 KB cada uno. | `exp4` del JSON; `gh-exp4-*.png`, `local-exp4-*.png` |

Revisión de los 21 SVG: el más pesado tiene 374,8 KB (tope 600); 0 tienen direcciones `http`
fuera del `xmlns`, `<script>`, `foreignObject` o atributos `on*` (`svg` del JSON).

### Experimento 2, caso por caso

H es el mayor hueco horizontal entre pestañas vecinas; V, el hueco entre la fila y el cuerpo.
Éxito: H y V de 0 px (tolerancia 0,5) y ninguna pestaña en otra línea.

| Forma | 1280 oscuro | 1280 claro | 390 oscuro | 390 claro |
|---|---|---|---|---|
| 2a · en linea sin espacios | no: H 0 px, V 6 px, caídas 0 | no: H 0 px, V 6 px, caídas 0 | no: H 0 px, V 6 px, caídas 0 | no: H 0 px, V 6 px, caídas 0 |
| 2b · align="left" | no: H 777,5 px, V 0 px, caídas 1 | no: H 777,5 px, V 0 px, caídas 1 | no: H 292,906 px, V 0 px, caídas 2 | no: H 292,906 px, V 0 px, caídas 2 |
| 2c · tabla | no: H 27,031 px, V 19 px, caídas 0 | no: H 27,031 px, V 19 px, caídas 0 | no: H 27,031 px, V 19 px, caídas 0 | no: H 27,031 px, V 19 px, caídas 0 |
| 2d · en linea con align="top" | sí: H 0 px, V 0 px, caídas 0 | sí: H 0 px, V 0 px, caídas 0 | no: H 0 px, V 7,922 px, caídas 0 | no: H 0 px, V 7,922 px, caídas 0 |
| 2e · en linea con align="top", pestanas de 76 de alto | sí: H 0 px, V 0 px, caídas 0 | sí: H 0 px, V 0 px, caídas 0 | sí: H 0 px, V 0 px, caídas 0 | sí: H 0 px, V 0 px, caídas 0 |

Lo que explica cada falla, según las medidas:

- 2a: la fila deja 6 px abajo: la imagen en línea se apoya en la línea base del texto y queda el
  espacio de los trazos que bajan.
- 2b: con `align="left"` la última pestaña se cae a otra línea (1 a 1280 px, 2 a 390 px): las seis ya no
  caben en el ancho. La causa no está medida; lo probable es el relleno que la hoja de estilos de
  GitHub pone a las imágenes con `align`.
- 2c: la tabla pone 27,031 px entre celdas y 19 px entre filas (relleno y bordes de las celdas).
- 2d: con `align="top"` desaparece el hueco de la línea base; falla solo a 390 px, donde la pestaña
  mide 16,078 px y la línea de texto de GitHub mide 24 px: sobran 7,922 px.
- 2e: igual que 2d, con las pestañas de 76 de alto (la barra de título va dentro): a 390 px miden
  29,094 px, más que los 24 px de la línea, y no queda hueco.

Regla que sale de esto (cálculo, no medido): cada fila de imágenes sueltas tiene que medir al menos
24 px de alto en el ancho más angosto. A 390 px el cuerpo mide 324 px, así que una fila de 846 de ancho
necesita al menos 63 de alto. Con 76 de alto, el límite queda en un cuerpo de unos 267 px (una
pantalla de unos 333 px); por debajo aparecería hueco.

En las capturas ampliadas de 2d y 2e en tema claro (fondo blanco detrás) no se ve costura entre
pestañas ni entre la fila y el cuerpo.

### Experimento 3, caso por caso

| Caso | Archivo que carga | Fondo de la página (estilo / captura) |
|---|---|---|
| 1280 oscuro | `exp3-oscuro-v1.svg` | rgb(13, 17, 23) / #0d1117 |
| 1280 claro | `exp3-claro-v1.svg` | rgb(255, 255, 255) / #ffffff |
| 390 oscuro | `exp3-oscuro-v1.svg` | rgb(13, 17, 23) / #0d1117 |
| 390 claro | `exp3-claro-v1.svg` | rgb(255, 255, 255) / #ffffff |

Las rutas relativas del `srcset` funcionan: GitHub las convierte en `github.com/.../raw/...`.

### Experimento 4, detalle

- Armado: rejilla de 63 x 65 cuadros (celdas de 31 unidades del dibujo), 24 olas entre 0,15 s y
  unos 2,2 s, del centro hacia afuera con azar. Diferencia contra el original por tiempo (oscuro):
  0,2 s: 32,663 % · 0,4 s: 32,077 % · 0,6 s: 30,129 % · 1,2 s: 15,659 % · 2,5 s: 0,008 % · 3,78 s: 0,008 % · 3,88 s: 1,385 % · 5 s: 0,233 % · 5,5 s: 0,24 % · 6,46 s: 1,385 % · 8,5 s: 0,008 %.
  Los cuadros de 3,88 y 6,46 s caen en los dos parpadeos (ojos cerrados) y los de 5 y 5,5 s en la
  mirada a cada lado: por eso no son 0. El de 3,78 s es justo antes del primer parpadeo.
- Parpadeo: cada 7 s desde los 2,5 s, dos veces por ciclo, unos 170 ms. Un párpado del color de la
  piel tapa el iris entero y lleva la línea de ojo cerrado. En el ojo derecho el iris toca la línea
  de arriba de los lentes; el párpado se corta en y=936 para no morderla. Revisado en capturas
  ampliadas: sin restos del iris ni recortes en los lentes (queda una línea fina bajo los lentes,
  que se lee como el pliegue del párpado).
- Mirada: la pupila se corre 14 unidades y crece lo justo para seguir tapando su sitio, recortada
  al tamaño del ojo: no deja medialunas.
- Reducir movimiento: el `@media (prefers-reduced-motion)` dentro del SVG no llega a la imagen
  cuando la página emula esa preferencia: sin `<picture>`, a 0,4 s la diferencia es
  32,061 % (todavía armándose). Por eso el README usa `<picture>` con
  `<source media="(prefers-reduced-motion: reduce)">` y una versión quieta del dibujo; en GitHub se
  cargó `exp4-avatar-oscuro-quieto-v1.svg` y dio 0,014 % contra el original.
  El `@media` se queda dentro del SVG por si otro navegador sí lo aplica.
- La comparación de fidelidad pinta el original como `<img>`, igual que el animado. Pintado en
  línea, el mismo original difiere 4,413 % de sí mismo como `<img>` (el navegador reescala la
  imagen); está en el JSON como `originalImgVsOriginalEnLinea`.

## 2. Recomendación

- **Plan A**, con la forma 2e (imágenes en línea sin espacios, `align="top"`, cada fila de al
  menos 24 px de alto en el celular): fue la única con 0 px de hueco y 0 caídas en los cuatro
  casos; la fila de botones del boceto es baja y habrá que hacerla más alta o juntarla con otra.
- **Fuentes embebidas:** GitHub las pinta igual que en local (0 %) y el control sí se nota, así que
  no hace falta pasar el texto a trazos.

## 3. Falta

- La app de GitHub del celular: no la puedo probar. La prueba Marco (animación, tema y pestañas).
- Otros navegadores: solo se midió Chromium 156.0.8078.4. Firefox y Safari no.
- Reducir movimiento real del sistema: se midió con la emulación de Playwright, no con el ajuste
  del sistema operativo (no se cambian ajustes del sistema).
- Sesión iniciada en GitHub con un tema elegido a mano: no se probó; todo es sin sesión.
- Anchos menores de 390 px (320 o 360): no se midieron; el límite de 2e es un cálculo.
- Enlaces de las pestañas: son anclas provisionales de `https://www.kairomx.tech/cv/`; no se
  comprobó que existan.
- Contraste medido en la captura (sección 9 de la spec): no es parte de este piloto.

## 4. Propuestas

- Recortar las fuentes a los caracteres que se usan (por ejemplo `pyftsubset` de fontTools,
  licencia MIT; pide `pip install fonttools brotli`). Hoy cada SVG con texto lleva las tres
  fuentes enteras (115,2 KB). Versión y estado no verificados hoy; necesita el «va» de Marco.
- Medir 2e a 320 y 360 px antes de fijar el plan A, y probarlo en la app del celular.
- El generador del piloto lee el avatar y las fuentes de `_trabajo/fuentes` (no se sube): en un
  clon limpio `node piloto/generar.mjs` no tiene de dónde leer. Para la pieza 1, decidir si las
  fuentes (OFL, con su licencia) y el avatar viven en el repositorio del perfil o se bajan del sitio.
- El párpado está ajustado a mano para este dibujo: si el avatar cambia, el generador debería
  avisar (por ejemplo, comprobar que las pupilas siguen en el mismo sitio) y el parpadeo se vuelve
  a mirar en capturas.
- Borrar la rama `piloto-cabecera` cuando Marco decida, o dejarla como evidencia: es pública.

## 5. Commit

Commit medido: `e6a27fc`, empujado a `origin/piloto-cabecera`. Este informe va en el commit
siguiente de la misma rama.
