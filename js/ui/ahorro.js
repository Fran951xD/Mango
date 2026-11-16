// "¿Dónde rindió más tu plata?": qué hubiera pasado con un monto según dónde lo ponías.

import { ajustarPorInflacion, reducirPuntos, restarMeses, simularInversion, variacionReal } from '../calc.js';
import { crearGrafico, crearTabla } from '../charts.js';
import { formatearCompacto, formatearFecha, formatearFechaLarga, formatearMes, formatearPesosRedondo, formatearPorcentaje } from '../format.js';
import { $, campoMonto, copiar, el, url } from './dom.js';

// Color fijo por opción: el mismo en este gráfico y en el panel de mercado.
const OPCIONES = [
  { clave: 'blue', nombre: 'Dólar blue', clase: 'serie-2', detalle: 'Comprado al precio de venta y vendido hoy al de compra.' },
  { clave: 'bolsa', nombre: 'Dólar MEP', clase: 'serie-3', detalle: 'Comprado al precio de venta y vendido hoy al de compra.' },
  { clave: 'oficial', nombre: 'Dólar oficial', clase: 'serie-1', detalle: 'Precio de banco, sin impuestos ni límites de compra.' },
  { clave: 'uva', nombre: 'Plazo fijo UVA', clase: 'serie-4', detalle: 'Ajuste por UVA, sin contar el interés extra que paga cada banco.' },
  { clave: 'pesos', nombre: 'Guardar los pesos', clase: 'serie-neutra', detalle: 'Sin invertir: los mismos billetes hoy.' },
];

const estado = { monto: 1000000, desde: null, datos: null, grafico: null };

function calcular() {
  const { monto, desde, datos } = estado;
  if (!(monto > 0) || !desde || !datos) return null;
  const hoy = datos.historico.oficial.venta.at(-1)?.fecha;

  const resultados = OPCIONES.map((o) => {
    let sim;
    if (o.clave === 'pesos') {
      sim = { valorFinal: monto, variacion: 0, evolucion: [{ fecha: desde, valor: monto }, { fecha: hoy, valor: monto }], desde };
    } else if (o.clave === 'uva') {
      sim = simularInversion(monto, desde, datos.uva.filter((p) => p.fecha <= hoy));
    } else {
      const h = datos.historico[o.clave];
      sim = simularInversion(monto, desde, h.venta, h.compra.length ? h.compra : h.venta);
    }
    return sim ? { ...o, ...sim } : null;
  }).filter(Boolean);

  // La inflación se publica con un mes y medio de atraso: se compara hasta el último mes con dato.
  const ultimoMes = datos.inflacion.at(-1)?.fecha.slice(0, 7);
  const ajuste = ultimoMes ? ajustarPorInflacion(monto, datos.inflacion, desde.slice(0, 7), ultimoMes) : null;
  let acumulado = monto;
  const evolucionInflacion = [{ fecha: desde, valor: monto }, ...(ajuste?.recorrido ?? []).map((p) => ({ fecha: p.fecha, valor: (acumulado *= 1 + p.valor / 100) }))];

  for (const r of resultados) r.real = ajuste ? variacionReal(r.variacion, ajuste.porcentaje) : null;
  resultados.sort((a, b) => b.valorFinal - a.valorFinal);
  return { resultados, ajuste, evolucionInflacion, ultimoMes, hoy };
}

function filaResultado(r, maximo, posicion) {
  const gano = r.real != null && r.real > 0.05;
  const empato = r.real != null && Math.abs(r.real) <= 0.05;
  return el(
    'li',
    { class: `ranking__fila ${r.clase}` },
    el('div', { class: 'ranking__cabeza' },
      el('span', { class: 'ranking__nombre' }, el('span', { class: 'clave-serie', 'aria-hidden': 'true' }), r.nombre),
      el('strong', { class: 'ranking__valor' }, formatearPesosRedondo(r.valorFinal))),
    el('div', { class: 'ranking__pista', 'aria-hidden': 'true' },
      el('div', { class: 'ranking__barra', style: `width:${Math.max(1.5, (r.valorFinal / maximo) * 100)}%` })),
    el('p', { class: 'ranking__detalle' },
      el('span', {}, `${formatearPorcentaje(r.variacion, { signo: true })} en pesos`),
      r.real == null ? null : el('span', { class: gano ? 'positivo' : empato ? '' : 'negativo' },
        empato ? 'Empató con la inflación' : `${gano ? 'Le ganó a' : 'Perdió contra'} la inflación por ${formatearPorcentaje(Math.abs(r.real))}`)),
    el('p', { class: 'ranking__nota' }, posicion === 0 && r.clave !== 'pesos' ? `${r.detalle} Fue la mejor opción del período.` : r.detalle),
  );
}

function render() {
  const salida = calcular();
  const lista = $('#ahorro-ranking');
  if (!salida || !salida.resultados.length) {
    lista.replaceChildren(el('li', { class: 'vacio' }, 'Escribí un monto y elegí una fecha para comparar.'));
    $('#ahorro-resumen').textContent = '';
    return;
  }
  const { resultados, ajuste, evolucionInflacion, ultimoMes, hoy } = salida;
  const maximo = Math.max(...resultados.map((r) => r.valorFinal), ajuste?.resultado ?? 0);
  lista.replaceChildren(...resultados.map((r, i) => filaResultado(r, maximo, i)));

  const mejor = resultados[0];
  const inicio = resultados.find((r) => r.clave !== 'pesos')?.desde ?? estado.desde;
  $('#ahorro-resumen').replaceChildren(
    `Si el ${formatearFechaLarga(inicio)} ponías ${formatearPesosRedondo(estado.monto)}, hoy tendrías `,
    el('strong', {}, formatearPesosRedondo(mejor.valorFinal)),
    ` en ${mejor.nombre.charAt(0).toLowerCase()}${mejor.nombre.slice(1)}. `,
    ajuste ? `Para no perder contra la inflación necesitabas ${formatearPesosRedondo(ajuste.resultado)} (dato hasta ${formatearMes(ultimoMes)}).` : '',
  );

  const series = [
    ...resultados.filter((r) => r.clave !== 'pesos').map((r) => ({ nombre: r.nombre, clase: r.clase, datos: reducirPuntos(r.evolucion, 300) })),
    { nombre: 'Inflación (para no perder)', clase: 'serie-referencia', referencia: true, datos: evolucionInflacion },
  ];
  const opciones = {
    tipo: 'linea',
    etiquetasFinales: false,
    descripcion: `Valor en pesos de ${formatearPesosRedondo(estado.monto)} invertidos el ${formatearFecha(inicio)}, según la opción`,
    formatoEje: (v) => `$ ${formatearCompacto(v)}`,
    formatoValor: formatearPesosRedondo,
    series,
  };
  if (estado.grafico) estado.grafico.actualizar(opciones);
  else estado.grafico = crearGrafico($('#ahorro-grafico'), opciones);

  const tabla = $('#ahorro-tabla');
  if (tabla.closest('details').open) {
    crearTabla(tabla, {
      titulo: 'Resultado por opción',
      columnas: [
        { titulo: 'Opción', valor: (r) => r.nombre },
        { titulo: 'Valor hoy', valor: (r) => formatearPesosRedondo(r.valorFinal), numerica: true },
        { titulo: 'En pesos', valor: (r) => formatearPorcentaje(r.variacion, { signo: true }), numerica: true },
        { titulo: 'Contra la inflación', valor: (r) => formatearPorcentaje(r.real, { signo: true }), numerica: true },
      ],
      filas: resultados,
    });
  }
  $('#ahorro-hasta').textContent = `Valores al ${formatearFecha(hoy)}.`;
  url.escribir({ ahorro_monto: Math.round(estado.monto), ahorro_desde: estado.desde });
}

export function iniciarAhorro() {
  const montoUrl = Number(url.leer('ahorro_monto'));
  if (montoUrl > 0) estado.monto = montoUrl;
  campoMonto($('#ahorro-monto'), (n) => {
    estado.monto = n;
    render();
  }).escribir(estado.monto);

  const fecha = $('#ahorro-fecha');
  fecha.addEventListener('change', () => {
    if (!fecha.value) return;
    estado.desde = fecha.value < fecha.min ? fecha.min : fecha.value > fecha.max ? fecha.max : fecha.value;
    render();
  });

  $('#ahorro-atajos').addEventListener('click', (e) => {
    const boton = e.target.closest('[data-meses]');
    if (!boton || !estado.datos) return;
    estado.desde = restarMeses(fecha.max, Number(boton.dataset.meses));
    if (estado.desde < fecha.min) estado.desde = fecha.min;
    fecha.value = estado.desde;
    render();
  });

  $('#ahorro-tabla').closest('details').addEventListener('toggle', render);
  $('#ahorro-copiar').addEventListener('click', (e) => copiar(`${$('#ahorro-resumen').textContent} ${location.href}`, e.currentTarget));
}

export function actualizarAhorro(datos) {
  estado.datos = datos;
  const fecha = $('#ahorro-fecha');
  const comienzos = [datos.historico.oficial.venta, datos.historico.blue.venta, datos.historico.bolsa.venta, datos.uva].map((s) => s[0]?.fecha).filter(Boolean);
  const hoy = datos.historico.oficial.venta.at(-1)?.fecha;
  if (!hoy) return;
  fecha.min = comienzos.sort().at(-1);
  fecha.max = hoy;
  const desdeUrl = url.leer('ahorro_desde');
  estado.desde = (/^\d{4}-\d{2}-\d{2}$/.test(desdeUrl ?? '') ? desdeUrl : null) ?? estado.desde ?? restarMeses(hoy, 12);
  if (estado.desde < fecha.min) estado.desde = fecha.min;
  fecha.value = estado.desde;
  render();
}
