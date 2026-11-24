// La pizarra: como las de las casas de cambio, con compra, venta, brecha y cambio del día.

import { brecha, variacion } from '../calc.js';
import { formatearCotizacion, formatearFecha, formatearHora, formatearPorcentaje } from '../format.js';
import { CASAS } from './casas.js';
import { $, el } from './dom.js';

const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)');
let yaAnimo = false;

/** Cambio del precio de venta respecto del cierre anterior a la fecha del dato de hoy. */
function cambioDelDia(dato, serie) {
  if (!serie?.length || !dato.fechaActualizacion) return null;
  const hoy = dato.fechaActualizacion.slice(0, 10);
  const anterior = serie.findLast((p) => p.fecha < hoy);
  return anterior ? variacion(anterior.valor, dato.venta) : null;
}

function celdaCambio(cambio) {
  if (cambio == null) {
    return el('td', { class: 'pizarra__cambio', title: 'Sin cierre anterior para comparar' },
      el('span', { 'aria-hidden': 'true' }, '—'), el('span', { class: 'solo-lectores' }, 'sin dato'));
  }
  const plano = Math.abs(cambio) < 0.05;
  const simbolo = plano ? '=' : cambio > 0 ? '▲' : '▼';
  const clase = plano ? '' : cambio > 0 ? 'sube' : 'baja';
  return el(
    'td',
    { class: `pizarra__cambio ${clase}` },
    el('span', { 'aria-hidden': 'true' }, `${simbolo} `),
    plano ? 'Sin cambios' : formatearPorcentaje(Math.abs(cambio)),
    el('span', { class: 'solo-lectores' }, plano ? '' : cambio > 0 ? ' de suba' : ' de baja'),
  );
}

/** Un número de la pizarra; en la primera carga las cifras "caen" una vez, como en los carteles. */
function cifra(valor) {
  const texto = formatearCotizacion(valor);
  const nodo = el('span', { class: 'pizarra__cifra' }, el('span', { class: 'solo-lectores' }, `$ ${texto}`));
  [...texto].forEach((caracter, i) => {
    nodo.append(el('span', { 'aria-hidden': 'true', style: `--i:${i}` }, caracter));
  });
  return nodo;
}

export function renderPizarra({ actuales, historico }) {
  const tabla = $('#pizarra-filas');
  const porCasa = new Map(actuales.map((d) => [d.casa, d]));
  const oficial = porCasa.get('oficial')?.venta;

  const filas = CASAS.filter((c) => porCasa.has(c.casa)).map((c) => {
    const dato = porCasa.get(c.casa);
    const b = c.casa === 'oficial' ? null : brecha(dato.venta, oficial);
    const serie = c.historico ? historico[c.historico]?.venta : null;
    return el(
      'tr',
      {},
      el('th', { scope: 'row' }, el('span', { class: 'pizarra__nombre' }, c.nombre), el('span', { class: 'pizarra__ayuda' }, c.ayuda)),
      el('td', { class: 'pizarra__precio' }, dato.compra ? cifra(dato.compra) : el('span', { class: 'pizarra__nd', 'aria-label': 'No aplica' }, '—')),
      el('td', { class: 'pizarra__precio' }, cifra(dato.venta)),
      el('td', { class: 'pizarra__brecha' }, b == null ? el('span', { class: 'pizarra__nd' }, 'base') : formatearPorcentaje(b, { signo: true })),
      celdaCambio(cambioDelDia(dato, serie)),
    );
  });
  tabla.replaceChildren(...filas);

  const pizarra = $('#pizarra');
  if (!yaAnimo && !reducirMovimiento.matches) {
    pizarra.classList.add('pizarra--entrando');
    setTimeout(() => pizarra.classList.remove('pizarra--entrando'), 1400);
  }
  yaAnimo = true;

  const ultima = actuales.map((d) => d.fechaActualizacion).filter(Boolean).sort().at(-1);
  $('#pizarra-hora').textContent = ultima ? `Actualizado el ${formatearFecha(ultima)} a las ${formatearHora(ultima)}` : '';
}
