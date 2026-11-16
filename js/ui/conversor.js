// Conversor pesos ⇄ dólares con el precio correcto para cada operación.

import { convertir } from '../calc.js';
import { formatearDolares, formatearPesos } from '../format.js';
import { CASAS_CONVERSOR, casaPorClave } from './casas.js';
import { $, campoMonto, el, preferencias } from './dom.js';

const estado = {
  monto: preferencias.leer('conversor-monto', 100000),
  direccion: preferencias.leer('conversor-direccion', 'ars-usd'),
  casa: preferencias.leer('conversor-casa', 'blue'),
  cotizaciones: new Map(),
};

const formatoDestino = () => (estado.direccion === 'ars-usd' ? formatearDolares : formatearPesos);

function render() {
  const { monto, direccion, casa, cotizaciones } = estado;
  const dato = cotizaciones.get(casa);
  const resultado = $('#conv-resultado');
  const detalle = $('#conv-detalle');
  $('#conv-moneda').textContent = direccion === 'ars-usd' ? 'pesos' : 'dólares';
  $('#conv-invertir').setAttribute('aria-label', direccion === 'ars-usd' ? 'Cambiar a dólares a pesos' : 'Cambiar a pesos a dólares');

  if (!dato || monto == null) {
    resultado.textContent = '—';
    detalle.textContent = monto == null ? 'Escribí un monto para convertir.' : 'No hay cotización para este tipo de dólar.';
    $('#conv-otros').replaceChildren();
    return;
  }

  const valor = convertir(monto, dato, direccion);
  resultado.textContent = formatoDestino()(valor);
  const usaVenta = direccion === 'ars-usd' || !dato.compra;
  const precio = usaVenta ? dato.venta : dato.compra;
  detalle.textContent = direccion === 'ars-usd'
    ? `Comprando a ${formatearPesos(precio)} por dólar, el precio de venta del ${casaPorClave.get(casa).nombre.toLowerCase()}.`
    : `Vendiendo a ${formatearPesos(precio)} por dólar, el precio de ${usaVenta && !dato.compra ? 'referencia' : 'compra'} del ${casaPorClave.get(casa).nombre.toLowerCase()}.`;

  // Comparación con los otros tipos: cuánto cambia el resultado según dónde operes.
  const otros = CASAS_CONVERSOR.filter((c) => c !== casa && cotizaciones.has(c))
    .filter((c) => !(direccion === 'usd-ars' && c === 'tarjeta'))
    .map((c) => ({ c, v: convertir(monto, cotizaciones.get(c), direccion) }))
    .filter((x) => x.v != null);
  $('#conv-otros').replaceChildren(
    ...otros.map(({ c, v }) =>
      el(
        'li',
        {},
        el('button', { type: 'button', class: 'conv-otro', dataset: { casa: c }, 'aria-label': `Usar ${casaPorClave.get(c).nombre}: ${formatoDestino()(v)}` },
          el('span', {}, casaPorClave.get(c).nombre),
          el('span', { class: 'conv-otro__valor' }, formatoDestino()(v))),
      ),
    ),
  );
}

function guardar() {
  preferencias.guardar('conversor-monto', estado.monto);
  preferencias.guardar('conversor-direccion', estado.direccion);
  preferencias.guardar('conversor-casa', estado.casa);
}

export function iniciarConversor() {
  const campo = campoMonto($('#conv-monto'), (n) => {
    estado.monto = n;
    render();
    guardar();
  });
  campo.escribir(estado.monto);

  const selector = $('#conv-casa');
  selector.replaceChildren(...CASAS_CONVERSOR.map((c) => el('option', { value: c }, casaPorClave.get(c).nombre)));
  selector.value = estado.casa;
  selector.addEventListener('change', () => {
    estado.casa = selector.value;
    render();
    guardar();
  });

  $('#conv-invertir').addEventListener('click', () => {
    estado.direccion = estado.direccion === 'ars-usd' ? 'usd-ars' : 'ars-usd';
    if (estado.direccion === 'usd-ars' && estado.casa === 'tarjeta') {
      estado.casa = 'oficial';
      selector.value = 'oficial';
    }
    render();
    guardar();
  });

  $('#conv-otros').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-casa]');
    if (!boton) return;
    estado.casa = boton.dataset.casa;
    selector.value = estado.casa;
    render();
    guardar();
    selector.focus();
  });
}

export function actualizarConversor(actuales) {
  estado.cotizaciones = new Map(actuales.map((d) => [d.casa, d]));
  if (!estado.cotizaciones.has(estado.casa)) estado.casa = 'oficial';
  $('#conv-casa').value = estado.casa;
  for (const opcion of $('#conv-casa').options) opcion.disabled = !estado.cotizaciones.has(opcion.value);
  render();
}
