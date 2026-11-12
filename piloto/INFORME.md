# Informe del piloto técnico de la cabecera

Medido el 2026-11-12 (12:00 UTC) con chromium 156.0.8078.4 sin cabeza, en
https://github.com/MarcoSebastianOrtegaMolina/MarcoSebastianOrtegaMolina/tree/piloto-cabecera sin sesión iniciada. Los números salen de `_trabajo/capturas/medicion.json` (versión nueva)
y de `_trabajo/capturas-d06d201/medicion.json` (las mismas comprobaciones contra el commit anterior,
con `--ref d06d201`). `_trabajo/` no se sube; se regenera con
`node piloto/medir.cjs _trabajo/capturas` y `node piloto/medir.cjs _trabajo/capturas-d06d201 --ref d06d201`.

Diferencia entre dos capturas: porcentaje de píxeles en los que algún canal cambia más de
32/255. «GitHub» es la imagen tal como la entrega y la monta github.com en la página de la
rama, pintada por ese Chromium; «local» es el mismo SVG en una página propia, al mismo tamaño, con la
misma fracción de píxel y el mismo fondo.

## 1. Resultados

| Experimento | Resultado | Medida | Se comprueba con |
|---|---|---|---|
| 1. Fuentes embebidas | sí | Por línea de texto, GitHub contra local: Space Grotesk 0 %, Space Mono 0 %, Inter 0 % (tope 1 %). Cada control al que le falta una fuente da en su línea 6,371 %, 6,605 % y 16,382 %: los tres se detectan. | `segundaVuelta.B1` del JSON; `sv-b1-gh-*.png` |
| 2. Pestañas pegadas | sí, con la forma 2f | 2f (cada pieza en un `<picture>` con su tema, filas de 84 de alto): anchos con hueco o caída de 320 a 1400 px, en oscuro y claro, a 1x y 2x: dark-dpr1: 0; dark-dpr2: 0; light-dpr1: 0; light-dpr2: 0. Se sostiene desde 303 px; más angosto queda hueco (0,781 px a 300 px). Cada pieza carga el archivo de su tema: sí. | `segundaVuelta.M1_M3` del JSON; `sv-m1-f-320-*.png` |
| 3. Tema claro y oscuro | sí | Oscuro carga `exp3-oscuro-v1.svg` sobre #0d1117; claro carga `exp3-claro-v1.svg` sobre #ffffff. Igual a 390 px. GitHub sin sesión sigue la emulación (`data-color-mode="auto"`). | `exp3` del JSON; `gh-exp3-*.png` |
| 4. Avatar animado | sí | Un solo `<picture>` con cuatro fuentes. En GitHub carga el archivo esperado en 4 de 4 combinaciones. Captura final contra la local del tema esperado: oscuro 0,007 %, oscuro + reducir 0,016 %, claro 0,002 %, claro + reducir 0,01 %. La animación corre: 32,13 % y 30,878 % entre 0,4 y 8,5 s. Fidelidad del cuadro final: 0,008 % y 0,007 %. Peso 375,1 KB. | `segundaVuelta.M2` y `exp4` del JSON; `sv-m2-*.png` |

Revisión de los 38 SVG: el más pesado tiene 375,1 KB (tope 600); 0 tienen direcciones `http`
fuera del `xmlns`, `<script>`, `foreignObject` o atributos `on*`.

## 2. Segunda vuelta: hallazgos del revisor

Cada fila tiene su comprobación en `piloto/medir.cjs` (sección «Segunda vuelta»). «Antes» es esa misma
comprobación corrida contra `d06d201` (página `github.com/.../tree/d06d201` y sus SVG sacados con
`git show`); «después», contra la versión nueva. Se corrieron las dos de verdad, para todas las filas.

| Hallazgo | Qué se hizo | Antes (d06d201) | Después | Se comprueba con | Estado |
|---|---|---|---|---|---|
| M1. Costura a anchos chicos | Filas de 84 de alto: a 320 px la línea de GitHub mide 24 px y la fila 25,2 px. Barrido de 300 a 1400 px de 1 en 1, oscuro y claro, 1x y 2x, con el borde derecho dentro del criterio. | Falla: dark-dpr1: 8 anchos de 320 en adelante (300-327); dark-dpr2: 8 anchos de 320 en adelante (300-327); light-dpr1: 8 anchos de 320 en adelante (300-327); light-dpr2: 8 anchos de 320 en adelante (300-327). Se sostiene desde 328 px. | Pasa: anchos con falla de 320 en adelante, dark-dpr1: 0; dark-dpr2: 0; light-dpr1: 0; light-dpr2: 0. Se sostiene desde 303 px. | `M1_M3`; `sv-m1-f-320-light-dpr2.png` | resuelto |
| M2. Avatar con tema y reducir movimiento | Un solo `<picture>` con cuatro fuentes (oscuro y reducir, oscuro, reducir, claro por defecto). | Falla: no hay imagen con alt exp4-avatar. | Pasa: oscuro carga `exp4-avatar-oscuro-v2.svg`; oscuro + reducir carga `exp4-avatar-oscuro-quieto-v2.svg`; claro carga `exp4-avatar-claro-v2.svg`; claro + reducir carga `exp4-avatar-claro-quieto-v2.svg`. GitHub deja pasar `media` con `and`. | `M2`; `sv-m2-*.png` | resuelto |
| M3. Pestañas con tema | Cada pestaña y el cuerpo como `<a><picture><source><img align="top"></picture></a>`. | Falla: la forma del plan A (2e) no lleva `<picture>` ni variante de tema. | Pasa: las 7 piezas cargan su tema en los 4 casos y el barrido de M1 se hizo sobre esta forma. | `M1_M3` (`piezas`, `temaBien`) | resuelto |
| B1. Falta de una sola fuente | Comparación por línea de texto (una banda por fuente) y un control por fuente. | Falla: con el criterio global, sin Space Mono da 0,48 % y pasaría por «se pinta». | Pasa: en su línea, sin Space Grotesk 6,3 %, sin Space Mono 6,669 %, sin Inter 16,424 % (local); en GitHub, lo de la fila 1. | `B1`; `local-sv-b1-*.png`, `sv-b1-gh-*.png` | resuelto |
| B2. Canto y astilla del párpado derecho | El párpado derecho se corta con la línea del lente (escaneada columna por columna) en vez de en y=936, y la elipse sube y crece para tapar todo el iris. | Falla: restos del iris 178 px, canto 16, mordida 0 unidades (oscuro). | Pasa: restos 0 y 0 px, canto 0 y 0, mordida 4 y 5 unidades (oscuro y claro; topes 8 px, 5 y 5). | `B2`; `sv-b2-*-cerrado-*.png` contra `sv-b2-*-original.png` | resuelto |
| B3. Parpadeo de golpe | El párpado baja y sube con `scaleY` desde arriba: 180 ms bajando, 60 ms cerrado, 180 ms subiendo, a velocidad pareja. | Falla: cierre en 0 ms con 0 cuadros intermedios. | Pasa: cierre visible 150 ms y apertura 175 ms, con 5 y 5 cuadros intermedios cada 25 ms, sin saltos. | `B3`; `sv-b3-*-mitad.png` | resuelto |
| B4. Cuadro de 3,78 s | Los cuadros del parpadeo se toman con el reloj de la animación fijo (`currentTime`); los de reloj real se eligen a 150 ms o más de cada parpadeo medido. | Falla: 2,5 s a 1300 ms, 3,78 s a 20 ms, 8,5 s a 1875 ms. | Pasa: 2,5 s a 1250 ms, 3,4 s a 350 ms, 8,5 s a 1725 ms; el mismo instante dos veces da 0 % de diferencia. | `B4` | resuelto |

Cómo se miden B2 y B3: el SVG se abre como documento a 1 unidad del dibujo por píxel y se fija el
reloj de todas sus animaciones. B2 compara el ojo derecho cerrado con el original: restos son píxeles
oscuros dentro del ojo que no son la línea de ojo cerrado; canto y mordida, cuánto queda el borde de
abajo de la línea del lente por debajo o por encima del original (donde el iris se junta con esa
línea, entre las columnas limpias vecinas). B3 recorre cada parpadeo cada 25 ms y cuenta los cuadros
intermedios. Los topes de B2 los puse antes de medir; la regla de las columnas vecinas la cambié
después de ver que la mediana daba falsos cantos en la parte dibujada a mano, y la línea del tope
del párpado la ajusté en tres vueltas mirando esta medida y las capturas ampliadas (está en el código).

### Experimento 2, los cuatro casos pedidos

H es el mayor hueco horizontal entre pestañas vecinas; V, el hueco entre la fila y el cuerpo. Éxito:
H y V de 0 px (tolerancia 0,5) y ninguna pestaña en otra línea.

| Forma | 1280 oscuro | 1280 claro | 390 oscuro | 390 claro |
|---|---|---|---|---|
| 2a | no: H 0 px, V 6 px, caídas 0 | no: H 0 px, V 6 px, caídas 0 | no: H 0 px, V 6 px, caídas 0 | no: H 0 px, V 6 px, caídas 0 |
| 2b | no: H 777,5 px, V 0 px, caídas 1 | no: H 777,5 px, V 0 px, caídas 1 | no: H 292,906 px, V 0 px, caídas 2 | no: H 292,906 px, V 0 px, caídas 2 |
| 2c | no: H 27,031 px, V 19 px, caídas 0 | no: H 27,031 px, V 19 px, caídas 0 | no: H 27,031 px, V 19 px, caídas 0 | no: H 27,031 px, V 19 px, caídas 0 |
| 2d | sí: H 0 px, V 0 px, caídas 0 | sí: H 0 px, V 0 px, caídas 0 | no: H 0 px, V 7,922 px, caídas 0 | no: H 0 px, V 7,922 px, caídas 0 |
| 2e | sí: H 0 px, V 0 px, caídas 0 | sí: H 0 px, V 0 px, caídas 0 | sí: H 0 px, V 0 px, caídas 0 | sí: H 0 px, V 0 px, caídas 0 |
| 2f | sí: H 0 px, V 0 px, caídas 0 | sí: H 0 px, V 0 px, caídas 0 | sí: H 0 px, V 0 px, caídas 0 | sí: H 0 px, V 0 px, caídas 0 |

2a deja 6 px de línea base; en 2b la última pestaña se cae a otra línea; la tabla pone
27,031 px entre celdas; 2d y 2e solo funcionan mientras la fila mida al menos los 24 px de la
línea de texto de GitHub. 2f es 2e con `<picture>` y filas de 84 de alto.

### Experimento 3, caso por caso

| Caso | Archivo que carga | Fondo de la página (estilo / captura) |
|---|---|---|
| 1280 oscuro | `exp3-oscuro-v1.svg` | rgb(13, 17, 23) / #0d1117 |
| 1280 claro | `exp3-claro-v1.svg` | rgb(255, 255, 255) / #ffffff |
| 390 oscuro | `exp3-oscuro-v1.svg` | rgb(13, 17, 23) / #0d1117 |
| 390 claro | `exp3-claro-v1.svg` | rgb(255, 255, 255) / #ffffff |

### Experimento 4, detalle

- Armado: rejilla de 63 x 65 cuadros, 24 olas entre 0,15 s y unos 2,2 s, del centro hacia afuera
  con azar. Contra el original como `<img>` y reloj real (oscuro): 0,2 s: 32,66 % · 0,4 s: 32,061 % · 0,6 s: 30,073 % · 1,2 s: 13,563 % · 2,5 s: 0,008 % · 3,4 s: 0,008 % · 5 s: 0,233 % · 5,5 s: 0,24 % · 8,5 s: 0,008 %.
  Los de 5 y 5,5 s son la mirada a cada lado.
- Parpadeo: dos por ciclo de 7 s desde los 2,5 s (el primero empieza a verse a los 3,775 s y el segundo
  a los 6,375 s). Revisado en cuadros fijos en los dos temas: ojo cerrado sin restos del iris y sin
  morder el lente; a mitad del cierre se ve el párpado bajando sobre el iris.
- Mirada: la pupila se corre 14 unidades y crece lo justo para seguir tapando su sitio, recortada al
  tamaño del ojo.
- Reducir movimiento: el `@media` dentro del SVG no llega a la imagen con la emulación (sin
  `<picture>`, a 0,4 s: 32,054 %); por eso el `<picture>` elige la versión quieta.

## 3. Recomendación

- **Plan A**, con la forma 2f: cada pestaña y el cuerpo en su `<picture>`, imágenes en línea sin
  espacios con `align="top"` y cada fila de al menos 80 de alto sobre 846 de ancho. La fila de
  botones del boceto es baja: hay que juntarla con otra o hacerla más alta.
- **Fuentes embebidas:** GitHub las pinta igual que en local, línea por línea, y cada fuente que falta
  se nota; no hace falta pasar el texto a trazos.

## 4. Falta

- La app de GitHub del celular: no la puedo probar. La prueba Marco (animación, tema y pestañas).
- Firefox y Safari: solo se midió Chromium 156.0.8078.4.
- Reducir movimiento y tema del sistema reales: se midió con la emulación de Playwright.
- GitHub con sesión iniciada y un tema elegido a mano: no se probó.
- Por debajo de 320 px: 2f se sostiene desde 303 px; más angosto no se buscó arreglo.
- Enlaces de las pestañas: anclas provisionales de `https://www.kairomx.tech/cv/`, no comprobadas.
- Contraste medido en la captura (sección 9 de la spec): no es parte del piloto.

## 5. Propuestas

- Recortar las fuentes a los caracteres usados (por ejemplo `pyftsubset` de fontTools, MIT; pide
  `pip install fonttools brotli`). Hoy cada SVG con texto lleva las fuentes enteras
  (115,2 KB). Versión y estado no verificados hoy; necesita el «va» de Marco.
- El generador lee el avatar y las fuentes de `_trabajo/fuentes` (no se sube): para la pieza 1,
  decidir si viven en el repositorio del perfil o se bajan del sitio.
- El tope del párpado derecho son coordenadas medidas para este dibujo: si el avatar cambia, el
  parpadeo se vuelve a medir con la comprobación B2.
- `_trabajo/` se ignora por `.git/info/exclude`, no por `.gitignore`: en otro clon no quedaría
  ignorada. Añadir `_trabajo/` a un `.gitignore` en la pieza 1.
- Borrar la rama `piloto-cabecera` cuando Marco decida, o dejarla como evidencia: es pública.

## 6. Commit

Commit medido: `c6dcbb8`, empujado a `origin/piloto-cabecera`. Este informe va en el commit
siguiente de la misma rama.
