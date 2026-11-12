# Piloto técnico de la cabecera del perfil

Rama de prueba. No es el perfil: aquí se mide si GitHub pinta lo que necesita el README nuevo.
Las medidas y la conclusión están en [piloto/INFORME.md](piloto/INFORME.md).

## Experimento 1: fuentes embebidas

Space Grotesk 600, Space Mono 700 e Inter 400 dentro del SVG, en base64.

<img alt="exp1-fuentes" width="100%" src="piloto/assets/exp1-fuentes-v1.svg">

Control: el mismo SVG pidiendo fuentes que no existen. Tiene que verse distinto.

<img alt="exp1-control" width="100%" src="piloto/assets/exp1-control-v1.svg">

Controles por fuente: a cada uno le falta una sola de las tres fuentes.

<img alt="exp1-sin-sg" width="100%" src="piloto/assets/exp1-sin-sg-v2.svg">

<img alt="exp1-sin-inter" width="100%" src="piloto/assets/exp1-sin-inter-v2.svg">

<img alt="exp1-sin-mono" width="100%" src="piloto/assets/exp1-sin-mono-v2.svg">

## Experimento 2: pestañas como imágenes pegadas

Seis pestañas, cada una con su enlace, y debajo el cuerpo de la ventana. Los enlaces son provisionales.

### 2a. En línea, sin espacios entre etiquetas

<p><a href="https://www.kairomx.tech/cv/#home"><img alt="exp2a-t1" width="13.9480%" src="piloto/assets/exp2-pestana1-v1.svg"></a><a href="https://www.kairomx.tech/cv/#projects"><img alt="exp2a-t2" width="17.4941%" src="piloto/assets/exp2-pestana2-v1.svg"></a><a href="https://www.kairomx.tech/cv/#stack"><img alt="exp2a-t3" width="14.1844%" src="piloto/assets/exp2-pestana3-v1.svg"></a><a href="https://www.kairomx.tech/cv/#experience"><img alt="exp2a-t4" width="20.0946%" src="piloto/assets/exp2-pestana4-v1.svg"></a><a href="https://www.kairomx.tech/cv/#about"><img alt="exp2a-t5" width="15.1300%" src="piloto/assets/exp2-pestana5-v1.svg"></a><a href="https://www.kairomx.tech/cv/#contact"><img alt="exp2a-t6" width="19.1489%" src="piloto/assets/exp2-pestana6-v1.svg"></a><br><img alt="exp2a-cuerpo" width="100%" src="piloto/assets/exp2-cuerpo-v1.svg"></p>

### 2b. Con align="left"

<p><a href="https://www.kairomx.tech/cv/#home"><img alt="exp2b-t1" width="13.9480%" align="left" src="piloto/assets/exp2-pestana1-v1.svg"></a><a href="https://www.kairomx.tech/cv/#projects"><img alt="exp2b-t2" width="17.4941%" align="left" src="piloto/assets/exp2-pestana2-v1.svg"></a><a href="https://www.kairomx.tech/cv/#stack"><img alt="exp2b-t3" width="14.1844%" align="left" src="piloto/assets/exp2-pestana3-v1.svg"></a><a href="https://www.kairomx.tech/cv/#experience"><img alt="exp2b-t4" width="20.0946%" align="left" src="piloto/assets/exp2-pestana4-v1.svg"></a><a href="https://www.kairomx.tech/cv/#about"><img alt="exp2b-t5" width="15.1300%" align="left" src="piloto/assets/exp2-pestana5-v1.svg"></a><a href="https://www.kairomx.tech/cv/#contact"><img alt="exp2b-t6" width="19.1489%" align="left" src="piloto/assets/exp2-pestana6-v1.svg"></a><img alt="exp2b-cuerpo" width="100%" src="piloto/assets/exp2-cuerpo-v1.svg"></p>

### 2c. En una tabla

<table>
<tr><td><a href="https://www.kairomx.tech/cv/#home"><img alt="exp2c-t1" src="piloto/assets/exp2-pestana1-v1.svg"></a></td><td><a href="https://www.kairomx.tech/cv/#projects"><img alt="exp2c-t2" src="piloto/assets/exp2-pestana2-v1.svg"></a></td><td><a href="https://www.kairomx.tech/cv/#stack"><img alt="exp2c-t3" src="piloto/assets/exp2-pestana3-v1.svg"></a></td><td><a href="https://www.kairomx.tech/cv/#experience"><img alt="exp2c-t4" src="piloto/assets/exp2-pestana4-v1.svg"></a></td><td><a href="https://www.kairomx.tech/cv/#about"><img alt="exp2c-t5" src="piloto/assets/exp2-pestana5-v1.svg"></a></td><td><a href="https://www.kairomx.tech/cv/#contact"><img alt="exp2c-t6" src="piloto/assets/exp2-pestana6-v1.svg"></a></td></tr>
<tr><td colspan="6"><img alt="exp2c-cuerpo" width="100%" src="piloto/assets/exp2-cuerpo-v1.svg"></td></tr>
</table>

### 2d. En línea, con align="top"

<p><a href="https://www.kairomx.tech/cv/#home"><img alt="exp2d-t1" width="13.9480%" align="top" src="piloto/assets/exp2-pestana1-v1.svg"></a><a href="https://www.kairomx.tech/cv/#projects"><img alt="exp2d-t2" width="17.4941%" align="top" src="piloto/assets/exp2-pestana2-v1.svg"></a><a href="https://www.kairomx.tech/cv/#stack"><img alt="exp2d-t3" width="14.1844%" align="top" src="piloto/assets/exp2-pestana3-v1.svg"></a><a href="https://www.kairomx.tech/cv/#experience"><img alt="exp2d-t4" width="20.0946%" align="top" src="piloto/assets/exp2-pestana4-v1.svg"></a><a href="https://www.kairomx.tech/cv/#about"><img alt="exp2d-t5" width="15.1300%" align="top" src="piloto/assets/exp2-pestana5-v1.svg"></a><a href="https://www.kairomx.tech/cv/#contact"><img alt="exp2d-t6" width="19.1489%" align="top" src="piloto/assets/exp2-pestana6-v1.svg"></a><br><img alt="exp2d-cuerpo" width="100%" align="top" src="piloto/assets/exp2-cuerpo-v1.svg"></p>

### 2e. En línea, con align="top" y pestañas de 76 de alto (barra de título encima)

<p><a href="https://www.kairomx.tech/cv/#home"><img alt="exp2e-t1" width="13.9480%" align="top" src="piloto/assets/exp2-alta1-v1.svg"></a><a href="https://www.kairomx.tech/cv/#projects"><img alt="exp2e-t2" width="17.4941%" align="top" src="piloto/assets/exp2-alta2-v1.svg"></a><a href="https://www.kairomx.tech/cv/#stack"><img alt="exp2e-t3" width="14.1844%" align="top" src="piloto/assets/exp2-alta3-v1.svg"></a><a href="https://www.kairomx.tech/cv/#experience"><img alt="exp2e-t4" width="20.0946%" align="top" src="piloto/assets/exp2-alta4-v1.svg"></a><a href="https://www.kairomx.tech/cv/#about"><img alt="exp2e-t5" width="15.1300%" align="top" src="piloto/assets/exp2-alta5-v1.svg"></a><a href="https://www.kairomx.tech/cv/#contact"><img alt="exp2e-t6" width="19.1489%" align="top" src="piloto/assets/exp2-alta6-v1.svg"></a><br><img alt="exp2e-cuerpo" width="100%" align="top" src="piloto/assets/exp2-cuerpo-v1.svg"></p>

### 2f. Como 2e, cada pieza en un picture con su variante de tema, y fila de 84 de alto

<p><a href="https://www.kairomx.tech/cv/#home"><picture><source media="(prefers-color-scheme: dark)" srcset="piloto/assets/exp2-f-oscuro1-v3.svg"><img alt="exp2f-t1" width="13.9480%" align="top" src="piloto/assets/exp2-f-claro1-v3.svg"></picture></a><a href="https://www.kairomx.tech/cv/#projects"><picture><source media="(prefers-color-scheme: dark)" srcset="piloto/assets/exp2-f-oscuro2-v3.svg"><img alt="exp2f-t2" width="17.4941%" align="top" src="piloto/assets/exp2-f-claro2-v3.svg"></picture></a><a href="https://www.kairomx.tech/cv/#stack"><picture><source media="(prefers-color-scheme: dark)" srcset="piloto/assets/exp2-f-oscuro3-v3.svg"><img alt="exp2f-t3" width="14.1844%" align="top" src="piloto/assets/exp2-f-claro3-v3.svg"></picture></a><a href="https://www.kairomx.tech/cv/#experience"><picture><source media="(prefers-color-scheme: dark)" srcset="piloto/assets/exp2-f-oscuro4-v3.svg"><img alt="exp2f-t4" width="20.0946%" align="top" src="piloto/assets/exp2-f-claro4-v3.svg"></picture></a><a href="https://www.kairomx.tech/cv/#about"><picture><source media="(prefers-color-scheme: dark)" srcset="piloto/assets/exp2-f-oscuro5-v3.svg"><img alt="exp2f-t5" width="15.1300%" align="top" src="piloto/assets/exp2-f-claro5-v3.svg"></picture></a><a href="https://www.kairomx.tech/cv/#contact"><picture><source media="(prefers-color-scheme: dark)" srcset="piloto/assets/exp2-f-oscuro6-v3.svg"><img alt="exp2f-t6" width="19.1489%" align="top" src="piloto/assets/exp2-f-claro6-v3.svg"></picture></a><br><picture><source media="(prefers-color-scheme: dark)" srcset="piloto/assets/exp2-f-cuerpo-oscuro-v3.svg"><img alt="exp2f-cuerpo" width="100%" align="top" src="piloto/assets/exp2-f-cuerpo-claro-v3.svg"></picture></p>

## Experimento 3: tema claro y oscuro

<picture>
<source media="(prefers-color-scheme: dark)" srcset="piloto/assets/exp3-oscuro-v1.svg">
<img alt="exp3-tema" width="100%" src="piloto/assets/exp3-claro-v1.svg">
</picture>

## Experimento 4: avatar animado

Entra armándose con cuadritos, parpadea y mira a los lados. Un solo picture con cuatro fuentes:
tema oscuro o claro, con o sin «reducir movimiento» (la versión quieta).

<picture>
<source media="(prefers-color-scheme: dark) and (prefers-reduced-motion: reduce)" srcset="piloto/assets/exp4-avatar-oscuro-quieto-v2.svg">
<source media="(prefers-color-scheme: dark)" srcset="piloto/assets/exp4-avatar-oscuro-v2.svg">
<source media="(prefers-reduced-motion: reduce)" srcset="piloto/assets/exp4-avatar-claro-quieto-v2.svg">
<img alt="exp4-avatar" width="400" src="piloto/assets/exp4-avatar-claro-v2.svg">
</picture>
