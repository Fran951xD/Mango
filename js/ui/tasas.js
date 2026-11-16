// Plazo fijo y billeteras hoy: quién paga más y si le gana a la inflación.

import { interesPlazoFijo, rendimientoPeriodoDesdeTea } from '../calc.js';
import { formatearMes, formatearPesosRedondo, formatearPorcentaje } from '../format.js';
import { $, campoMonto, el, pestanias } from './dom.js';

const estado = { monto: 1000000, dias: 30, filtro: '', vista: 'plazo', plazoFijo: [], rendimientos: [], inflacion: null };

/** Inflación esperada para el plazo: se usa la del último mes publicado, proyectada a los días elegidos. */
const inflacionDelPeriodo = () => (estado.inflacion ? ((1 + estado.inflacion.valor / 100) ** (estado.dias / 30) - 1) * 100 : null);

function veredicto(rendimiento, referencia) {
  if (referencia == null) return el('td', {}, '—');
  const diferencia = rendimiento - referencia;
  const gana = diferencia > 0.02;
  const empata = Math.abs(diferencia) <= 0.02;
  return el('td', { class: `veredicto-celda ${gana ? 'positivo' : empata ? '' : 'negativo'}` },
    el('span', { 'aria-hidden': 'true' }, gana ? '▲ ' : empata ? '= ' : '▼ '),
    gana ? 'Le gana' : empata ? 'Empata' : 'Pierde');
}

function filasPlazoFijo(referencia) {
  return estado.plazoFijo
    .filter((b) => b.entidad.toLowerCase().includes(estado.filtro))
    .map((b, i) => {
      const tna = b.tnaClientes ?? b.tnaNoClientes;
      const interes = interesPlazoFijo(estado.monto ?? 0, tna, estado.dias);
      const rendimiento = (tna * estado.dias) / 365;
      const nombre = b.enlace
        ? el('a', { href: b.enlace, target: '_blank', rel: 'noopener noreferrer' }, b.entidad)
        : b.entidad;
      return el('tr', { class: i === 0 && !estado.filtro ? 'destacada' : '' },
        el('th', { scope: 'row' }, nombre, i === 0 && !estado.filtro ? el('span', { class: 'etiqueta' }, 'Mejor tasa') : null),
        el('td', { class: 'num' }, formatearPorcentaje(tna, { decimales: 2 }),
          b.tnaClientes && !b.tnaNoClientes ? el('span', { class: 'nota-celda' }, 'solo clientes') : null),
        el('td', { class: 'num' }, estado.monto ? formatearPesosRedondo(interes) : '—'),
        el('td', { class: 'num' }, estado.monto ? formatearPesosRedondo(estado.monto + interes) : '—'),
        veredicto(rendimiento, referencia));
    });
}

function filasBilleteras(referencia) {
  return estado.rendimientos
    .filter((b) => b.entidad.toLowerCase().includes(estado.filtro))
    .map((b, i) => {
      const rendimiento = rendimientoPeriodoDesdeTea(b.apy, estado.dias);
      const interes = (estado.monto ?? 0) * (rendimiento / 100);
      return el('tr', { class: i === 0 && !estado.filtro ? 'destacada' : '' },
        el('th', { scope: 'row' }, b.entidad, i === 0 && !estado.filtro ? el('span', { class: 'etiqueta' }, 'Rinde más') : null),
        el('td', { class: 'num' }, formatearPorcentaje(b.apy, { decimales: 2 })),
        el('td', { class: 'num' }, estado.monto ? formatearPesosRedondo(interes) : '—'),
        el('td', { class: 'num' }, estado.monto ? formatearPesosRedondo(estado.monto + interes) : '—'),
        veredicto(rendimiento, referencia));
    });
}

function render() {
  const referencia = inflacionDelPeriodo();
  const esPlazo = estado.vista === 'plazo';
  const cuerpo = $(esPlazo ? '#tasas-plazo-filas' : '#tasas-billeteras-filas');
  const filas = esPlazo ? filasPlazoFijo(referencia) : filasBilleteras(referencia);
  const columnas = 5;
  cuerpo.replaceChildren(...(filas.length ? filas : [el('tr', {}, el('td', { colspan: columnas, class: 'vacio' },
    estado.filtro ? `Ninguna entidad coincide con "${estado.filtro}".` : 'No hay tasas disponibles en este momento. Probá actualizar en unos minutos.'))]));

  for (const th of document.querySelectorAll('[data-columna-dias]')) th.textContent = `Ganás en ${estado.dias} días`;
  $('#tasas-referencia').textContent = estado.inflacion
    ? `Para comparar usamos la inflación de ${formatearMes(estado.inflacion.fecha)} (${formatearPorcentaje(estado.inflacion.valor)} mensual), llevada a ${estado.dias} días: ${formatearPorcentaje(referencia, { decimales: 2 })}. Si la tasa rinde más que eso, le gana.`
    : '';
}

export function iniciarTasas() {
  campoMonto($('#tasas-monto'), (n) => {
    estado.monto = n;
    render();
  }).escribir(estado.monto);

  $('#tasas-dias').addEventListener('change', (e) => {
    estado.dias = Number(e.target.value);
    render();
  });
  $('#tasas-buscar').addEventListener('input', (e) => {
    estado.filtro = e.target.value.trim().toLowerCase();
    render();
  });
  pestanias($('#tasas-pestanias'), (vista) => {
    estado.vista = vista;
    render();
  });
}

export function actualizarTasas({ plazoFijo, rendimientos, inflacion }) {
  estado.plazoFijo = plazoFijo;
  estado.rendimientos = rendimientos;
  estado.inflacion = inflacion.at(-1) ?? null;
  render();
}
