import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ajustarPorInflacion, convertir, interesPlazoFijo, mensualDesdeAnual, normalizarTasa,
  rendimientoPeriodoDesdeTea, simularInversion, teaDesdeTna, valorEnFecha,
} from '../js/calc.js';

const cerca = (real, esperado, tolerancia = 1e-6) =>
  assert.ok(Math.abs(real - esperado) < tolerancia, `${real} no es ≈ ${esperado}`);

const inflacion = [
  { fecha: '2026-01-31', valor: 2 },
  { fecha: '2026-02-28', valor: 3 },
  { fecha: '2026-03-31', valor: 1 },
];

test('ajustarPorInflacion acumula los meses posteriores al de origen', () => {
  const r = ajustarPorInflacion(100000, inflacion, '2026-01', '2026-03');
  assert.equal(r.meses, 2); // febrero y marzo
  cerca(r.resultado, 100000 * 1.03 * 1.01);
  cerca(r.porcentaje, 4.03);
});

test('ajustarPorInflacion hacia atrás descuenta la inflación', () => {
  const adelante = ajustarPorInflacion(100000, inflacion, '2026-01', '2026-03');
  const atras = ajustarPorInflacion(adelante.resultado, inflacion, '2026-03', '2026-01');
  cerca(atras.resultado, 100000);
});

test('ajustarPorInflacion con el mismo mes no cambia el monto', () => {
  const r = ajustarPorInflacion(5000, inflacion, '2026-02', '2026-02');
  assert.equal(r.resultado, 5000);
  assert.equal(r.meses, 0);
});

test('valorEnFecha toma el último dato disponible (feriados, fines de semana)', () => {
  const serie = [{ fecha: '2026-01-02', valor: 1 }, { fecha: '2026-01-05', valor: 2 }];
  assert.equal(valorEnFecha(serie, '2026-01-04').valor, 1);
  assert.equal(valorEnFecha(serie, '2026-01-05').valor, 2);
  assert.equal(valorEnFecha(serie, '2025-12-31'), null);
});

test('simularInversion compra al precio de venta y vende al de compra', () => {
  const venta = [{ fecha: '2026-01-02', valor: 1000 }, { fecha: '2026-06-01', valor: 1200 }];
  const compra = [{ fecha: '2026-01-02', valor: 960 }, { fecha: '2026-06-01', valor: 1150 }];
  const r = simularInversion(100000, '2026-01-02', venta, compra);
  cerca(r.unidades, 100);
  cerca(r.valorFinal, 115000);
  cerca(r.variacion, 15);
  // Recién comprado, vender ya implica perder la diferencia entre compra y venta.
  cerca(r.evolucion[0].valor, 96000);
});

test('simularInversion sin monto o sin datos devuelve null', () => {
  assert.equal(simularInversion(0, '2026-01-01', [{ fecha: '2026-01-01', valor: 1 }]), null);
  assert.equal(simularInversion(100, '2026-01-01', []), null);
});

test('normalizarTasa acepta decimales o porcentajes', () => {
  assert.equal(normalizarTasa(0.32), 32);
  assert.equal(normalizarTasa(32), 32);
  assert.equal(normalizarTasa(null), null);
  assert.equal(normalizarTasa(0), null);
});

test('interesPlazoFijo usa interés simple sobre la TNA', () => {
  cerca(interesPlazoFijo(1000000, 36.5, 30), 30000);
  assert.equal(interesPlazoFijo(1000000, 0, 30), null);
});

test('teaDesdeTna capitaliza cada 30 días', () => {
  cerca(teaDesdeTna(36.5, 30), ((1 + 0.03) ** (365 / 30) - 1) * 100);
});

test('rendimientoPeriodoDesdeTea y mensualDesdeAnual son consistentes', () => {
  cerca(rendimientoPeriodoDesdeTea(26.8241794, 365), 26.8241794);
  cerca(mensualDesdeAnual(26.8241794), 2, 1e-4);
});

test('convertir usa venta para comprar dólares y compra para venderlos', () => {
  const cotizacion = { compra: 1400, venta: 1450 };
  cerca(convertir(145000, cotizacion, 'ars-usd'), 100);
  cerca(convertir(100, cotizacion, 'usd-ars'), 140000);
  // La tarjeta no tiene precio de compra: se usa el de venta como referencia.
  cerca(convertir(10, { compra: null, venta: 2000 }, 'usd-ars'), 20000);
});
