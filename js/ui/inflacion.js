// Calculadora: llevar un monto de un mes a otro según la inflación (alquiler, sueldo, un precio viejo).

import { ajustarPorInflacion } from '../calc.js';
import { crearGrafico } from '../charts.js';
import { MESES, formatearCompacto, formatearMes, formatearPesosRedondo, formatearPorcentaje } from '../format.js';
import { $, $$, campoMonto, copiar, el, url } from './dom.js';

const estado = { monto: 350000, desde: null, hasta: null, inflacion: [], grafico: null };

const mesAnterior = (mes, cantidad) => {
  const [y, m] = mes.split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1 - cantidad, 1));
  return fecha.toISOString().slice(0, 7);
};

function llenarSelectores(prefijo, mesElegido) {
  const anios = [...new Set(estado.inflacion.map((p) => p.fecha.slice(0, 4)))];
  const selAnio = $(`#${prefijo}-anio`);
  const selMes = $(`#${prefijo}-mes`);
  if (selMes.options.length === 0) selMes.append(...MESES.map((nombre, i) => el('option', { value: String(i + 1).padStart(2, '0') }, nombre)));
  selAnio.replaceChildren(...anios.map((a) => el('option', { value: a }, a)));
  const [y, m] = mesElegido.split('-');
  selAnio.value = y;
  selMes.value = m;
}

const leerSelector = (prefijo) => `${$(`#${prefijo}-anio`).value}-${$(`#${prefijo}-mes`).value}`;

function limitarAlRango(mes) {
  const primero = estado.inflacion[0].fecha.slice(0, 7);
  const ultimo = estado.inflacion.at(-1).fecha.slice(0, 7);
  return mes < primero ? primero : mes > ultimo ? ultimo : mes;
}

function render() {
  const { monto, desde, hasta, inflacion } = estado;
  const resultado = ajustarPorInflacion(monto, inflacion, desde, hasta);
  const salida = $('#infl-resultado');
  const frase = $('#infl-frase');

  if (monto == null || !resultado) {
    salida.textContent = '—';
    frase.textContent = 'Escribí un monto para calcular.';
    return;
  }

  const haciaAdelante = hasta >= desde;
  salida.textContent = formatearPesosRedondo(resultado.resultado);
  if (desde === hasta) {
    frase.textContent = 'Elegí dos meses distintos para ver cuánto cambiaron los precios.';
  } else {
    const periodo = `${resultado.meses} ${resultado.meses === 1 ? 'mes' : 'meses'}`;
    frase.replaceChildren(
      `${formatearPesosRedondo(monto)} de ${formatearMes(desde)} ${haciaAdelante ? 'equivalen a' : 'equivalían a'} `,
      el('strong', {}, formatearPesosRedondo(resultado.resultado)),
      ` en ${formatearMes(hasta)}. `,
      haciaAdelante
        ? `En ${periodo} los precios subieron ${formatearPorcentaje(resultado.porcentaje)}.`
        : `En esos ${periodo} los precios habían subido ${formatearPorcentaje(1 / resultado.factor * 100 - 100)}.`,
    );
  }

  // Evolución: cuánta plata hacía falta cada mes para comprar lo mismo.
  let acumulado = monto;
  const recorrido = haciaAdelante ? resultado.recorrido : [];
  const evolucion = [{ fecha: `${desde}-28`, valor: monto }, ...recorrido.map((p) => ({ fecha: p.fecha, valor: (acumulado *= 1 + p.valor / 100) }))];
  const contenedor = $('#infl-grafico');
  contenedor.hidden = evolucion.length < 3;
  if (!contenedor.hidden) {
    const opciones = {
      tipo: 'linea',
      area: true,
      descripcion: 'Monto necesario cada mes para comprar lo mismo',
      formatoEje: (v) => (v >= 10000 ? `$ ${formatearCompacto(v)}` : formatearPesosRedondo(v)),
      formatoValor: formatearPesosRedondo,
      formatoFecha: formatearMes,
      series: [{ nombre: 'Equivale a', clase: 'serie-1', datos: evolucion }],
    };
    if (estado.grafico) estado.grafico.actualizar(opciones);
    else estado.grafico = crearGrafico(contenedor, opciones);
  }

  url.escribir({ infl_monto: Math.round(monto), infl_desde: desde, infl_hasta: hasta === inflacion.at(-1).fecha.slice(0, 7) ? null : hasta });
}

export function iniciarInflacion() {
  const desdeUrl = Number(url.leer('infl_monto'));
  if (desdeUrl > 0) estado.monto = desdeUrl;
  const campo = campoMonto($('#infl-monto'), (n) => {
    estado.monto = n;
    render();
  });
  campo.escribir(estado.monto);

  for (const prefijo of ['infl-desde', 'infl-hasta']) {
    for (const sel of $$(`#${prefijo}-mes, #${prefijo}-anio`)) {
      sel.addEventListener('change', () => {
        estado[prefijo === 'infl-desde' ? 'desde' : 'hasta'] = limitarAlRango(leerSelector(prefijo));
        render();
      });
    }
  }

  $('#infl-atajos').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-meses]');
    if (!boton || !estado.inflacion.length) return;
    const meses = boton.dataset.meses;
    estado.hasta = estado.inflacion.at(-1).fecha.slice(0, 7);
    estado.desde = limitarAlRango(meses === 'enero' ? `${estado.hasta.slice(0, 4)}-01` : mesAnterior(estado.hasta, Number(meses)));
    if (meses === 'enero' && estado.desde === estado.hasta) estado.desde = mesAnterior(estado.hasta, 1);
    llenarSelectores('infl-desde', estado.desde);
    llenarSelectores('infl-hasta', estado.hasta);
    render();
  });

  $('#infl-copiar').addEventListener('click', (e) => {
    copiar(`${$('#infl-frase').textContent} Calculado con Mango: ${location.href}`, e.currentTarget);
  });
}

export function actualizarInflacion(inflacion) {
  if (!inflacion.length) return;
  estado.inflacion = inflacion;
  const ultimo = inflacion.at(-1).fecha.slice(0, 7);
  const valido = (mes) => (mes && /^\d{4}-\d{2}$/.test(mes) ? limitarAlRango(mes) : null);
  estado.hasta = valido(url.leer('infl_hasta')) ?? estado.hasta ?? ultimo;
  estado.desde = valido(url.leer('infl_desde')) ?? estado.desde ?? mesAnterior(ultimo, 12);
  llenarSelectores('infl-desde', estado.desde);
  llenarSelectores('infl-hasta', estado.hasta);
  $('#infl-ultimo').textContent = `Último dato del INDEC: ${formatearMes(ultimo)}, ${formatearPorcentaje(inflacion.at(-1).valor)} mensual.`;
  render();
}
