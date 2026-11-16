// Genera data/demo.json: datos de EJEMPLO con el mismo formato que las APIs.
// Siguen la forma aproximada de la economía argentina 2019–2026 pero son SINTÉTICOS:
// solo se muestran si las APIs no responden, siempre con un aviso visible.
// Uso: npm run demo:generar

import { writeFileSync } from 'node:fs';

let semilla = 7;
const azar = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
const ruido = (amplitud) => (azar() - 0.5) * 2 * amplitud;
const r2 = (v) => Math.round(v * 100) / 100;
const iso = (f) => f.toISOString().slice(0, 10);

const INICIO = new Date(Date.UTC(2019, 0, 2));
const FIN = new Date(Date.UTC(2026, 10, 13));

// Anclas de fin de año (valor de venta aproximado). Entre anclas se interpola en escala logarítmica.
const anclas = {
  oficial: { 2019: 38, 2020: 63, 2021: 89, 2022: 108, 2023: 183, 2024: 830, 2025: 1065, 2026: 1475, 2027: 1520 },
  blue: { 2019: 38, 2020: 78, 2021: 166, 2022: 208, 2023: 346, 2024: 1010, 2025: 1235, 2026: 1490, 2027: 1500 },
  bolsa: { 2019: 38, 2020: 70, 2021: 141, 2022: 199, 2023: 336, 2024: 980, 2025: 1170, 2026: 1480, 2027: 1530 },
};
// Clave = año en que TERMINA el tramo (2020 es el valor a fin de 2019).
const valorAncla = (tabla, fecha) => {
  const anio = fecha.getUTCFullYear();
  const inicioAnio = Date.UTC(anio, 0, 1);
  const t = (fecha - inicioAnio) / (Date.UTC(anio + 1, 0, 1) - inicioAnio);
  const a = tabla[anio];
  const b = tabla[anio + 1];
  return a * (b / a) ** t;
};

// Inflación mensual de ejemplo por mes (forma: 2019 alta, 2020 baja, 2022–2023 suba fuerte, 2024 desinflación).
function inflacionDelMes(anio, mes) {
  const t = anio + mes / 12;
  if (t < 2020) return 3.6;
  if (t < 2021) return 2.8;
  if (t < 2022) return 3.6;
  if (t < 2023) return 5.2 + (t - 2022) * 1.5;
  if (t < 2023.9) return 6 + (t - 2023) * 5;
  if (t < 2024.0) return 25.5;
  if (t < 2024.5) return 20.6 * Math.exp(-(t - 2024) * 4.1);
  if (t < 2026) return Math.max(1.9, 4.2 - (t - 2024.5) * 1.4);
  return 2.1;
}

const historico = { oficial: [], blue: [], bolsa: [] };
const uva = [];
const riesgoPais = [];
let nivelUva = 31.06;
let riesgo = 800;
const desvio = { oficial: 0, blue: 0, bolsa: 0 };

for (let f = new Date(INICIO); f <= FIN; f.setUTCDate(f.getUTCDate() + 1)) {
  const fecha = iso(f);
  const anio = f.getUTCFullYear();
  const mes = f.getUTCMonth();
  const diasMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();

  // UVA: todos los días, crece con la inflación (con el rezago habitual simplificado).
  nivelUva *= (1 + inflacionDelMes(anio, mes - 1) / 100) ** (1 / diasMes);
  uva.push({ fecha, valor: r2(nivelUva) });

  const dia = f.getUTCDay();
  if (dia === 0 || dia === 6) continue;

  for (const casa of Object.keys(historico)) {
    const volatilidad = casa === 'oficial' ? 0.002 : 0.01;
    desvio[casa] = desvio[casa] * 0.94 + ruido(volatilidad);
    const venta = valorAncla(anclas[casa], f) * (1 + desvio[casa]);
    const margen = casa === 'oficial' ? venta * 0.04 : casa === 'blue' ? venta * 0.015 : venta * 0.005;
    historico[casa].push({ casa, compra: r2(venta - margen), venta: r2(venta), fecha });
  }

  const t = anio + mes / 12;
  const objetivo = t < 2020.6 ? 2200 : t < 2023.9 ? 1900 + Math.sin(t * 3) * 300 : t < 2025 ? 1900 - (t - 2023.9) * 1100 : 620;
  riesgo += (objetivo - riesgo) * 0.01 + ruido(28);
  riesgoPais.push({ fecha, valor: Math.round(riesgo) });
}

const inflacion = [];
const inflacionInteranual = [];
const tasas = [];
for (let f = new Date(Date.UTC(2019, 0, 1)); f < new Date(Date.UTC(2026, 9, 1)); f.setUTCMonth(f.getUTCMonth() + 1)) {
  const valor = Math.round(Math.max(1.5, inflacionDelMes(f.getUTCFullYear(), f.getUTCMonth()) + ruido(0.35)) * 10) / 10;
  tasas.push(valor);
  const finMes = iso(new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)));
  inflacion.push({ fecha: finMes, valor });
  if (tasas.length >= 12) {
    const ia = (tasas.slice(-12).reduce((a, t) => a * (1 + t / 100), 1) - 1) * 100;
    inflacionInteranual.push({ fecha: finMes, valor: Math.round(ia * 10) / 10 });
  }
}

const ultimo = (casa) => historico[casa].at(-1);
const actualizado = '2026-11-13T17:58:00.000Z';
const actual = (casa, nombre, venta, compra) => ({
  moneda: 'USD', casa, nombre, compra: compra == null ? null : r2(compra), venta: r2(venta), fechaActualizacion: actualizado,
});
const of = ultimo('oficial');
const actuales = [
  actual('oficial', 'Oficial', of.venta, of.compra),
  actual('blue', 'Blue', ultimo('blue').venta, ultimo('blue').compra),
  actual('bolsa', 'Bolsa', ultimo('bolsa').venta, ultimo('bolsa').compra),
  actual('contadoconliqui', 'Contado con liquidación', ultimo('bolsa').venta * 1.012, ultimo('bolsa').compra * 1.012),
  actual('mayorista', 'Mayorista', of.venta * 0.975, of.venta * 0.965),
  actual('cripto', 'Cripto', ultimo('bolsa').venta * 1.018, ultimo('bolsa').venta * 0.99),
  actual('tarjeta', 'Tarjeta', of.venta * 1.3, null),
];

// Tasas de ejemplo: las entidades son genéricas a propósito para no atribuir datos falsos a bancos reales.
const plazoFijo = [
  ['Banco Ejemplo Uno', 0.335], ['Banco Ejemplo Dos', 0.32], ['Banco Ejemplo Tres', 0.31], ['Banco Ejemplo Cuatro', 0.30],
  ['Banco Ejemplo Cinco', 0.295], ['Banco Ejemplo Seis', 0.29], ['Banco Ejemplo Siete', 0.285], ['Compañía Financiera Ejemplo', 0.36],
  ['Banco Ejemplo Ocho', 0.27], ['Banco Ejemplo Nueve', 0.26],
].map(([entidad, tna]) => ({ entidad, logo: null, tnaClientes: tna, tnaNoClientes: tna > 0.3 ? tna - 0.01 : null, enlace: null }));

const rendimientos = [
  ['Billetera Ejemplo A', 31.2], ['Billetera Ejemplo B', 29.8], ['Billetera Ejemplo C', 28.4], ['Cuenta Remunerada Ejemplo', 27.5],
  ['Billetera Ejemplo D', 26.1],
].map(([entidad, apy]) => ({ entidad, rendimientos: [{ moneda: 'ARS', apy, fecha: '2026-11-13' }, { moneda: 'USD', apy: 1.5, fecha: '2026-11-13' }] }));

const demo = {
  _aviso: 'Datos de EJEMPLO generados por scripts/generar-demo.mjs. No son cotizaciones ni tasas reales.',
  actuales,
  oficial: historico.oficial,
  blue: historico.blue,
  bolsa: historico.bolsa,
  uva,
  inflacion,
  inflacionInteranual,
  riesgoPais,
  plazoFijo,
  rendimientos,
};

writeFileSync(new URL('../data/demo.json', import.meta.url), JSON.stringify(demo));
console.log(`demo.json: ${historico.oficial.length} días hábiles, ${inflacion.length} meses, UVA ${uva.at(-1).valor}, oficial ${of.venta}, blue ${ultimo('blue').venta}`);
