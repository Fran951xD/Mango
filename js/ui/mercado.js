// Panel de mercado: dólar, brecha, inflación y riesgo país, con un único filtro de período.

import { filtrarPorRango, reducirPuntos, serieBrecha, variacion } from '../calc.js';
import { crearGrafico, crearTabla } from '../charts.js';
import {
  formatearCompacto, formatearDecimal, formatearFecha, formatearMes, formatearNumero, formatearPesos, formatearPesosRedondo, formatearPorcentaje,
} from '../format.js';
import { $, $$, grupoRadio, url } from './dom.js';

const RANGOS = { '3m': 3, '6m': 6, '1a': 12, '3a': 36, '5a': 60, todo: null };
const estado = { rango: Object.hasOwn(RANGOS, url.leer('periodo') ?? '') ? url.leer('periodo') : '1a', vistaInflacion: 'mensual', datos: null, graficos: {} };

const ejePesos = (v) => (v >= 10000 ? `$ ${formatearCompacto(v)}` : `$ ${formatearNumero(v)}`);
const ejePct = (v) => `${formatearDecimal(v)} %`;

function graficar(id, opciones) {
  if (estado.graficos[id]) estado.graficos[id].actualizar(opciones);
  else estado.graficos[id] = crearGrafico($(`#${id}`), opciones);
}

/** Tabla equivalente al gráfico, solo si el panel "Ver los datos" está abierto (se arma recién ahí). */
function tablaSiAbierta(id, titulo, series, formato, formatoFecha = formatearFecha) {
  const contenedor = $(`#${id}`);
  if (!contenedor.closest('details').open) return;
  const fechas = [...new Set(series.flatMap((s) => s.datos.map((p) => p.fecha)))].sort().reverse().slice(0, 60);
  const mapas = series.map((s) => new Map(s.datos.map((p) => [p.fecha, p.valor])));
  crearTabla(contenedor, {
    titulo,
    columnas: [
      { titulo: 'Fecha', valor: (f) => formatoFecha(f) },
      ...series.map((s, i) => ({ titulo: s.nombre, valor: (f) => (mapas[i].has(f) ? formato(mapas[i].get(f)) : '—'), numerica: true })),
    ],
    filas: fechas,
  });
}

function cifraConCambio(id, valorTexto, cambio, { subeEsMalo = true, neutro = false, sufijo = 'en el período' } = {}) {
  const nodo = $(`#${id}`);
  const valor = document.createElement('span');
  valor.className = 'cifra__valor';
  valor.textContent = valorTexto;
  const detalle = document.createElement('span');
  detalle.className = 'cifra__detalle';
  if (cambio != null && Number.isFinite(cambio)) {
    const malo = subeEsMalo ? cambio > 0 : cambio < 0;
    const signo = document.createElement('span');
    signo.className = neutro || Math.abs(cambio) < 0.05 ? 'cifra__cambio' : malo ? 'negativo' : 'positivo';
    signo.textContent = formatearPorcentaje(cambio, { signo: true });
    detalle.append(signo, ` ${sufijo}`);
  }
  nodo.replaceChildren(valor, detalle);
}

function render() {
  if (!estado.datos) return;
  const { historico, inflacion, inflacionInteranual, riesgoPais } = estado.datos;
  const meses = RANGOS[estado.rango];
  const fin = historico.oficial.venta.at(-1)?.fecha;
  const recortar = (serie) => filtrarPorRango(serie, meses, fin);

  // Dólar
  const dolar = [
    { nombre: 'Oficial', clase: 'serie-1', datos: reducirPuntos(recortar(historico.oficial.venta)) },
    { nombre: 'Blue', clase: 'serie-2', datos: reducirPuntos(recortar(historico.blue.venta)) },
    { nombre: 'MEP', clase: 'serie-3', datos: reducirPuntos(recortar(historico.bolsa.venta)) },
  ];
  graficar('g-dolar', { tipo: 'linea', descripcion: 'Precio de venta del dólar oficial, blue y MEP', formatoEje: ejePesos, formatoValor: formatearPesos, series: dolar });
  const blue = dolar[1].datos;
  cifraConCambio('c-dolar', blue.length ? formatearPesosRedondo(blue.at(-1).valor) : '—', blue.length > 1 ? variacion(blue[0].valor, blue.at(-1).valor) : null, { neutro: true, sufijo: 'el blue en el período' });
  tablaSiAbierta('t-dolar', 'Precio de venta del dólar', dolar, formatearPesos);

  // Brecha
  const brechas = [
    { nombre: 'Blue', clase: 'serie-2', datos: reducirPuntos(recortar(serieBrecha(historico.blue.venta, historico.oficial.venta))) },
    { nombre: 'MEP', clase: 'serie-3', datos: reducirPuntos(recortar(serieBrecha(historico.bolsa.venta, historico.oficial.venta))) },
  ];
  graficar('g-brecha', { tipo: 'linea', incluirCero: true, descripcion: 'Brecha del dólar blue y MEP respecto del oficial', formatoEje: ejePct, formatoValor: (v) => formatearPorcentaje(v, { signo: true }), series: brechas });
  const ultimaBrecha = brechas[0].datos.at(-1);
  const cifraBrecha = $('#c-brecha');
  cifraBrecha.replaceChildren();
  if (ultimaBrecha) {
    const valor = document.createElement('span');
    valor.className = 'cifra__valor';
    valor.textContent = formatearPorcentaje(ultimaBrecha.valor, { signo: true });
    const detalle = document.createElement('span');
    detalle.className = 'cifra__detalle';
    detalle.textContent = `blue contra oficial, ${formatearFecha(ultimaBrecha.fecha)}`;
    cifraBrecha.append(valor, detalle);
  }
  tablaSiAbierta('t-brecha', 'Brecha con el oficial', brechas, (v) => formatearPorcentaje(v, { signo: true }));

  // Inflación (mensual o interanual: misma escala, distinta forma)
  const mensual = estado.vistaInflacion === 'mensual';
  const serieInfl = recortar(mensual ? inflacion : inflacionInteranual);
  const inflSeries = [{ nombre: mensual ? 'Mensual' : 'Interanual', clase: 'serie-inflacion', datos: serieInfl }];
  graficar('g-inflacion', {
    tipo: mensual ? 'barras' : 'linea', area: !mensual, incluirCero: true, formatoFecha: formatearMes,
    descripcion: `Inflación ${estado.vistaInflacion} según el INDEC`, formatoEje: ejePct, formatoValor: (v) => formatearPorcentaje(v), series: inflSeries,
  });
  const ultInfl = inflacion.at(-1);
  const ultIA = inflacionInteranual.at(-1);
  const cifraInfl = $('#c-inflacion');
  cifraInfl.replaceChildren();
  if (ultInfl) {
    const valor = document.createElement('span');
    valor.className = 'cifra__valor';
    valor.textContent = formatearPorcentaje(ultInfl.valor);
    const detalle = document.createElement('span');
    detalle.className = 'cifra__detalle';
    detalle.textContent = `en ${formatearMes(ultInfl.fecha)}${ultIA ? `, ${formatearPorcentaje(ultIA.valor)} en doce meses` : ''}`;
    cifraInfl.append(valor, detalle);
  }
  tablaSiAbierta('t-inflacion', 'Inflación', inflSeries, (v) => formatearPorcentaje(v), formatearMes);

  // Riesgo país
  const riesgo = [{ nombre: 'Riesgo país', clase: 'serie-riesgo', datos: reducirPuntos(recortar(riesgoPais)) }];
  graficar('g-riesgo', { tipo: 'linea', area: true, descripcion: 'Riesgo país en puntos básicos', formatoEje: formatearNumero, formatoValor: (v) => `${formatearNumero(v)} puntos`, series: riesgo });
  const r = riesgo[0].datos;
  cifraConCambio('c-riesgo', r.length ? `${formatearNumero(r.at(-1).valor)} pb` : '—', r.length > 1 ? variacion(r[0].valor, r.at(-1).valor) : null);
  tablaSiAbierta('t-riesgo', 'Riesgo país', riesgo, (v) => formatearNumero(v));
}

export function iniciarMercado() {
  const grupo = grupoRadio($('#mercado-periodo'), (valor) => {
    estado.rango = valor;
    url.escribir({ periodo: valor === '1a' ? null : valor });
    render();
  });
  grupo.elegir(estado.rango, { avisar: false });

  grupoRadio($('#mercado-inflacion'), (valor) => {
    estado.vistaInflacion = valor;
    render();
  });

  for (const detalle of $$('#mercado details')) detalle.addEventListener('toggle', render);
}

export function actualizarMercado(datos) {
  estado.datos = datos;
  render();
}
