// Formato de números y fechas en español de Argentina.

const NF = (opciones) => new Intl.NumberFormat('es-AR', opciones);
const pesos = NF({ style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pesosEnteros = NF({ style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const dolares = NF({ style: 'currency', currency: 'USD', currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const entero = NF({ maximumFractionDigits: 0 });
const unDecimal = NF({ minimumFractionDigits: 1, maximumFractionDigits: 1 });
const hastaUnDecimal = NF({ maximumFractionDigits: 1 });
const compacto = NF({ notation: 'compact', maximumFractionDigits: 1 });

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = MESES.map((m) => m.slice(0, 3));

const vacio = (v) => v == null || !Number.isFinite(v);

export const formatearPesos = (v) => (vacio(v) ? '—' : pesos.format(v));
export const formatearPesosRedondo = (v) => (vacio(v) ? '—' : pesosEnteros.format(v));
/** "US$ 1.234,56" — el código ISO "USD" se reemplaza por el símbolo local. */
export const formatearDolares = (v) => (vacio(v) ? '—' : dolares.format(v).replace('USD', 'US$').replace(/\s+/, ' '));
export const formatearNumero = (v) => (vacio(v) ? '—' : entero.format(v));
export const formatearDecimal = (v) => (vacio(v) ? '—' : hastaUnDecimal.format(v));
export const formatearCompacto = (v) => (vacio(v) ? '—' : compacto.format(v));

/** Precio para la pizarra: sin centavos si es grande, con coma si es chico. */
export function formatearCotizacion(v) {
  if (vacio(v)) return '—';
  return v >= 100 ? entero.format(v) : NF({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

/** 12.345 => "12,3 %". Con `signo`, agrega "+" a los positivos y usa el signo menos tipográfico. */
export function formatearPorcentaje(v, { signo = false, decimales = 1 } = {}) {
  if (vacio(v)) return '—';
  const formato = decimales === 1 ? unDecimal : NF({ minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  const texto = `${formato.format(Math.abs(v))} %`;
  if (v < 0 && Math.abs(v) >= 0.05 / 10 ** (decimales - 1)) return `−${texto}`;
  return signo && v > 0 ? `+${texto}` : texto;
}

/** "2026-11-13" => "13 nov 2026" */
export function formatearFecha(fechaISO) {
  if (!fechaISO) return '—';
  const [y, m, d] = fechaISO.slice(0, 10).split('-').map(Number);
  return `${d} ${MESES_CORTOS[m - 1]} ${y}`;
}

/** "2026-11-13" => "13 de noviembre de 2026" */
export function formatearFechaLarga(fechaISO) {
  if (!fechaISO) return '—';
  const [y, m, d] = fechaISO.slice(0, 10).split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

/** "2026-10" o "2026-10-31" => "octubre 2026" */
export function formatearMes(fechaISO) {
  if (!fechaISO) return '—';
  const [y, m] = fechaISO.slice(0, 7).split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

/** Etiqueta corta para ejes: "nov 26" */
export function formatearMesCorto(fechaISO) {
  const [y, m] = fechaISO.slice(0, 7).split('-').map(Number);
  return `${MESES_CORTOS[m - 1]} ${String(y).slice(2)}`;
}

/** Hora local de Buenos Aires de un timestamp ISO: "14:05" */
export function formatearHora(timestampISO) {
  const fecha = new Date(timestampISO);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' });
}

/** Interpreta lo que escribe una persona: "1.500.000", "1500000", "1.500,50", "$ 2.000". */
export function leerMonto(texto) {
  if (texto == null) return null;
  let limpio = String(texto).replace(/[^\d.,-]/g, '');
  if (!limpio) return null;
  const tieneComa = limpio.includes(',');
  // En Argentina el punto separa miles y la coma, decimales.
  if (tieneComa) limpio = limpio.replace(/\./g, '').replace(',', '.');
  else if ((limpio.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(limpio)) limpio = limpio.replace(/\./g, '');
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

/** Muestra un monto mientras se escribe: 1500000 => "1.500.000" */
export function formatearEntrada(numero) {
  if (vacio(numero)) return '';
  return NF({ maximumFractionDigits: 2 }).format(numero);
}
