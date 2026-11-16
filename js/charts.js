// Gráficos SVG propios (sin librerías), siguiendo especificaciones de visualización:
// líneas de 2 px, barras de máximo 24 px con extremo redondeado, grilla en hairline sólida,
// crosshair que se engancha a la fecha más cercana, tooltip con el valor primero,
// navegación con teclado y etiquetas directas solo en el último punto.

import { formatearFecha, formatearMesCorto } from './format.js';

const NS = 'http://www.w3.org/2000/svg';
const MARGEN = { arriba: 12, derecha: 12, abajo: 30, izquierda: 56 };
const ANCHO_ETIQUETA_FINAL = 78;

function svgEl(tag, atributos = {}, padre) {
  const nodo = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(atributos)) if (v != null) nodo.setAttribute(k, v);
  padre?.appendChild(nodo);
  return nodo;
}

function htmlEl(tag, clase, texto) {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto != null) nodo.textContent = texto;
  return nodo;
}

const aTiempo = (fechaISO) => Date.parse(`${fechaISO}T00:00:00Z`);

/** Valores "redondos" para el eje Y. */
export function ticksLindos(min, max, cantidad = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const delta = Math.abs(min) * 0.1 || 1;
    min -= delta;
    max += delta;
  }
  const crudo = (max - min) / cantidad;
  const magnitud = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * magnitud).find((p) => p >= crudo);
  const inicio = Math.floor(min / paso) * paso;
  const fin = Math.ceil(max / paso) * paso;
  const ticks = [];
  for (let v = inicio; v <= fin + paso / 2; v += paso) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

/** Barra vertical con el extremo de datos redondeado (4 px) y la base recta. */
function caminoBarra(x, ancho, yValor, yBase) {
  const alto = Math.abs(yBase - yValor);
  const r = Math.min(4, ancho / 2, alto);
  if (yValor <= yBase) {
    return `M${x},${yBase}V${yValor + r}Q${x},${yValor} ${x + r},${yValor}H${x + ancho - r}Q${x + ancho},${yValor} ${x + ancho},${yValor + r}V${yBase}Z`;
  }
  return `M${x},${yBase}V${yValor - r}Q${x},${yValor} ${x + r},${yValor}H${x + ancho - r}Q${x + ancho},${yValor} ${x + ancho},${yValor - r}V${yBase}Z`;
}

/**
 * Crea un gráfico dentro de `contenedor`.
 * opciones: {
 *   tipo: 'linea' | 'barras',
 *   series: [{ nombre, clase, datos: [{ fecha, valor }], referencia?: boolean }],
 *   formatoEje: (v) => string,       // ticks del eje Y
 *   formatoValor: (v) => string,     // tooltip y etiqueta final
 *   formatoFecha?: (fechaISO) => string,
 *   incluirCero?: boolean,
 *   area?: boolean,                  // relleno suave bajo la primera serie (solo una serie)
 *   etiquetasFinales?: boolean,      // valor al final de cada línea (por defecto, sí)
 *   descripcion: string              // nombre accesible del gráfico
 * }
 */
export function crearGrafico(contenedor, opcionesIniciales) {
  let opciones = opcionesIniciales;
  contenedor.classList.add('grafico');
  const alto = Number(contenedor.dataset.alto) || 260;

  const tooltip = htmlEl('div', 'grafico__tooltip');
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.hidden = true;
  const anuncio = htmlEl('p', 'solo-lectores');
  anuncio.setAttribute('aria-live', 'polite');

  let indiceActivo = null;

  function dibujar() {
    const ancho = Math.max(280, Math.round(contenedor.clientWidth));
    const { tipo = 'linea', formatoEje, formatoValor } = opciones;
    const formatoFecha = opciones.formatoFecha ?? formatearFecha;
    const incluirCero = opciones.incluirCero ?? tipo === 'barras';
    const series = opciones.series.filter((s) => s.datos?.length);
    contenedor.replaceChildren();

    if (!series.length) {
      contenedor.append(htmlEl('p', 'grafico__vacio', 'No hay datos para este período.'));
      return;
    }

    const conEtiquetas = tipo === 'linea' && (opciones.etiquetasFinales ?? true) && series.length <= 4;
    const margenDerecho = conEtiquetas ? ANCHO_ETIQUETA_FINAL : MARGEN.derecha;
    const anchoUtil = ancho - MARGEN.izquierda - margenDerecho;
    const altoUtil = alto - MARGEN.arriba - MARGEN.abajo;

    const valores = series.flatMap((s) => s.datos.map((p) => p.valor));
    let minY = Math.min(...valores);
    let maxY = Math.max(...valores);
    if (incluirCero) {
      minY = Math.min(0, minY);
      maxY = Math.max(0, maxY);
    }
    const ticks = ticksLindos(minY, maxY);
    const [y0, y1] = [ticks[0], ticks.at(-1)];
    const escalaY = (v) => MARGEN.arriba + (1 - (v - y0) / (y1 - y0)) * altoUtil;

    const referencia = series.find((s) => !s.referencia) ?? series[0];
    const fechas = referencia.datos.map((p) => p.fecha);
    const tiempos = series.flatMap((s) => [aTiempo(s.datos[0].fecha), aTiempo(s.datos.at(-1).fecha)]);
    const t0 = Math.min(...tiempos);
    const t1 = Math.max(...tiempos);
    const banda = tipo === 'barras' ? anchoUtil / fechas.length : 0;
    const indicePorFecha = new Map(fechas.map((f, i) => [f, i]));
    const escalaX = (fecha) =>
      tipo === 'barras'
        ? MARGEN.izquierda + banda * (indicePorFecha.get(fecha) + 0.5)
        : MARGEN.izquierda + (t1 === t0 ? anchoUtil / 2 : ((aTiempo(fecha) - t0) / (t1 - t0)) * anchoUtil);

    const svg = svgEl('svg', { viewBox: `0 0 ${ancho} ${alto}`, width: ancho, height: alto, role: 'img', 'aria-label': opciones.descripcion });

    // Grilla y eje Y
    const grilla = svgEl('g', { class: 'grafico__grilla', 'aria-hidden': 'true' }, svg);
    for (const v of ticks) {
      const y = Math.round(escalaY(v)) + 0.5;
      svgEl('line', { x1: MARGEN.izquierda, x2: ancho - margenDerecho, y1: y, y2: y, class: v === 0 && y0 < 0 ? 'cero' : null }, grilla);
      svgEl('text', { x: MARGEN.izquierda - 10, y: y + 4, 'text-anchor': 'end', class: 'grafico__eje' }, grilla).textContent = formatoEje(v);
    }

    // Eje X: etiquetas repartidas sin repetir mes
    const ejeX = svgEl('g', { 'aria-hidden': 'true' }, svg);
    const cantidad = Math.max(2, Math.min(fechas.length, Math.floor(anchoUtil / 84)));
    const usadas = new Set();
    for (let i = 0; i < cantidad; i++) {
      const fecha = fechas[Math.round((i * (fechas.length - 1)) / (cantidad - 1))];
      const texto = formatearMesCorto(fecha);
      if (usadas.has(texto)) continue;
      usadas.add(texto);
      const ancla = i === 0 ? 'start' : i === cantidad - 1 ? 'end' : 'middle';
      svgEl('text', { x: escalaX(fecha), y: alto - 9, 'text-anchor': tipo === 'barras' ? 'middle' : ancla, class: 'grafico__eje' }, ejeX).textContent = texto;
    }

    // Marcas
    const marcas = svgEl('g', { 'aria-hidden': 'true' }, svg);
    const barras = [];
    for (const serie of [...series].sort((a, b) => Number(b.referencia ?? false) - Number(a.referencia ?? false))) {
      const g = svgEl('g', { class: `grafico__serie ${serie.clase ?? ''} ${serie.referencia ? 'es-referencia' : ''}` }, marcas);
      if (tipo === 'barras') {
        const anchoBarra = Math.min(24, Math.max(2, banda - 2));
        const yBase = escalaY(Math.max(y0, Math.min(0, y1)));
        serie.datos.forEach((p) => {
          const barra = svgEl('path', { d: caminoBarra(escalaX(p.fecha) - anchoBarra / 2, anchoBarra, escalaY(p.valor), yBase) }, g);
          barras.push(barra);
        });
      } else {
        const puntos = serie.datos.map((p) => `${escalaX(p.fecha).toFixed(1)},${escalaY(p.valor).toFixed(1)}`);
        if (opciones.area && series.length === 1) {
          const base = escalaY(Math.max(y0, Math.min(0, y1))).toFixed(1);
          svgEl('path', { class: 'grafico__area', d: `M${puntos[0].split(',')[0]},${base}L${puntos.join('L')}L${puntos.at(-1).split(',')[0]},${base}Z` }, g);
        }
        svgEl('path', { class: 'grafico__linea', d: `M${puntos.join('L')}` }, g);
      }
    }

    // Etiquetas finales: valor al final de cada línea; si chocan, se omiten (la leyenda y el tooltip quedan).
    if (conEtiquetas) {
      const finales = series
        .map((s) => ({ s, p: s.datos.at(-1) }))
        .map(({ s, p }) => ({ s, p, y: escalaY(p.valor) }))
        .sort((a, b) => a.y - b.y);
      const chocan = finales.some((f, i) => i > 0 && f.y - finales[i - 1].y < 15);
      const g = svgEl('g', { 'aria-hidden': 'true' }, svg);
      for (const { s, p, y } of finales) {
        svgEl('circle', { cx: escalaX(p.fecha), cy: y, r: 4, class: `grafico__punto ${s.clase ?? ''}` }, g);
        if (!chocan) {
          svgEl('text', { x: escalaX(p.fecha) + 10, y: y + 4, class: 'grafico__etiqueta-final' }, g).textContent = formatoValor(p.valor);
        }
      }
    }

    // Capa de interacción
    const guia = svgEl('line', { y1: MARGEN.arriba, y2: alto - MARGEN.abajo, class: 'grafico__guia', visibility: 'hidden' }, svg);
    const marcadores = series.map((s) => svgEl('circle', { r: 4, class: `grafico__punto ${s.clase ?? ''}`, visibility: 'hidden' }, svg));
    const zona = svgEl('rect', {
      x: MARGEN.izquierda - 6, y: 0, width: anchoUtil + 12, height: alto - MARGEN.abajo + 6, fill: 'transparent',
      class: 'grafico__zona', tabindex: '0', role: 'slider', 'aria-label': `${opciones.descripcion}. Usá las flechas para recorrer las fechas.`,
      'aria-valuemin': '0', 'aria-valuemax': String(fechas.length - 1),
    }, svg);

    const mapas = series.map((s) => new Map(s.datos.map((p) => [p.fecha, p.valor])));

    const mostrar = (indice) => {
      indiceActivo = Math.max(0, Math.min(fechas.length - 1, indice));
      const fecha = fechas[indiceActivo];
      const x = escalaX(fecha);
      guia.setAttribute('x1', x);
      guia.setAttribute('x2', x);
      guia.setAttribute('visibility', tipo === 'barras' ? 'hidden' : 'visible');
      barras.forEach((b, i) => b.classList.toggle('activa', i === indiceActivo));

      const filas = [];
      series.forEach((s, i) => {
        // Para series con fechas distintas (ej. feriados), se toma el último valor conocido.
        let valor = mapas[i].get(fecha);
        if (valor == null && tipo === 'linea') {
          const previo = s.datos.findLast((p) => p.fecha <= fecha);
          valor = previo?.valor;
        }
        if (valor == null) {
          marcadores[i].setAttribute('visibility', 'hidden');
          return;
        }
        if (tipo === 'linea') {
          marcadores[i].setAttribute('cx', x);
          marcadores[i].setAttribute('cy', escalaY(valor));
          marcadores[i].setAttribute('visibility', 'visible');
        }
        filas.push({ s, valor });
      });

      const contenido = [htmlEl('div', 'grafico__tooltip-fecha', formatoFecha(fecha))];
      for (const { s, valor } of filas) {
        const fila = htmlEl('div', `grafico__tooltip-fila ${s.clase ?? ''} ${s.referencia ? 'es-referencia' : ''}`);
        fila.append(htmlEl('strong', null, formatoValor(valor)), htmlEl('span', null, s.nombre));
        contenido.push(fila);
      }
      tooltip.replaceChildren(...contenido);
      tooltip.hidden = false;

      const caja = svg.getBoundingClientRect();
      const escala = caja.width / ancho || 1;
      const anchoTooltip = tooltip.offsetWidth;
      let izquierda = x * escala + 14;
      if (izquierda + anchoTooltip > caja.width) izquierda = x * escala - 14 - anchoTooltip;
      tooltip.style.transform = `translate(${Math.max(0, izquierda)}px, ${MARGEN.arriba}px)`;

      zona.setAttribute('aria-valuenow', String(indiceActivo));
      zona.setAttribute('aria-valuetext', `${formatoFecha(fecha)}: ${filas.map(({ s, valor }) => `${s.nombre} ${formatoValor(valor)}`).join(', ')}`);
    };

    const ocultar = () => {
      indiceActivo = null;
      tooltip.hidden = true;
      guia.setAttribute('visibility', 'hidden');
      marcadores.forEach((m) => m.setAttribute('visibility', 'hidden'));
      barras.forEach((b) => b.classList.remove('activa'));
    };

    const indiceDesdePuntero = (evento) => {
      const caja = svg.getBoundingClientRect();
      const x = ((evento.clientX - caja.left) / caja.width) * ancho;
      let mejor = 0;
      let distancia = Infinity;
      // Búsqueda binaria: las fechas están ordenadas.
      let lo = 0;
      let hi = fechas.length - 1;
      while (lo <= hi) {
        const medio = (lo + hi) >> 1;
        const d = escalaX(fechas[medio]) - x;
        if (Math.abs(d) < distancia) [mejor, distancia] = [medio, Math.abs(d)];
        if (d < 0) lo = medio + 1;
        else hi = medio - 1;
      }
      return mejor;
    };

    zona.addEventListener('pointermove', (e) => mostrar(indiceDesdePuntero(e)));
    zona.addEventListener('pointerdown', (e) => mostrar(indiceDesdePuntero(e)));
    zona.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') ocultar();
    });
    zona.addEventListener('focus', () => mostrar(indiceActivo ?? fechas.length - 1));
    zona.addEventListener('blur', ocultar);
    zona.addEventListener('keydown', (e) => {
      const paso = e.shiftKey ? Math.max(1, Math.round(fechas.length / 10)) : 1;
      const acciones = {
        ArrowRight: () => mostrar((indiceActivo ?? -1) + paso),
        ArrowLeft: () => mostrar((indiceActivo ?? fechas.length) - paso),
        Home: () => mostrar(0),
        End: () => mostrar(fechas.length - 1),
        Escape: () => zona.blur(),
      };
      if (acciones[e.key]) {
        e.preventDefault();
        acciones[e.key]();
        anuncio.textContent = zona.getAttribute('aria-valuetext');
      }
    });

    contenedor.append(svg, tooltip, anuncio);
  }

  let anchoPrevio = 0;
  const observador = new ResizeObserver(([entrada]) => {
    const anchoNuevo = Math.round(entrada.contentRect.width);
    if (Math.abs(anchoNuevo - anchoPrevio) > 1) {
      anchoPrevio = anchoNuevo;
      dibujar();
    }
  });
  observador.observe(contenedor);
  anchoPrevio = Math.round(contenedor.clientWidth);
  dibujar();

  return {
    actualizar(nuevas) {
      opciones = { ...opciones, ...nuevas };
      dibujar();
    },
    destruir() {
      observador.disconnect();
      contenedor.replaceChildren();
    },
  };
}

/**
 * Tabla accesible equivalente a un gráfico.
 * columnas: [{ titulo, valor: (fila) => string, numerica?: boolean }]
 */
export function crearTabla(contenedor, { titulo, columnas, filas }) {
  const tabla = htmlEl('table', 'tabla-datos');
  if (titulo) tabla.append(htmlEl('caption', 'solo-lectores', titulo));
  const cabecera = tabla.createTHead().insertRow();
  for (const c of columnas) {
    const th = htmlEl('th', c.numerica ? 'num' : null, c.titulo);
    th.scope = 'col';
    cabecera.append(th);
  }
  const cuerpo = tabla.createTBody();
  for (const fila of filas) {
    const tr = cuerpo.insertRow();
    columnas.forEach((c, i) => {
      const celda = htmlEl(i === 0 ? 'th' : 'td', c.numerica ? 'num' : null, c.valor(fila));
      if (i === 0) celda.scope = 'row';
      tr.append(celda);
    });
  }
  contenedor.replaceChildren(tabla);
}
