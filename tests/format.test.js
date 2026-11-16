import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatearDolares, formatearFecha, formatearMes, formatearPorcentaje, leerMonto } from '../js/format.js';
import { ticksLindos } from '../js/charts.js';

test('formatearPorcentaje usa coma decimal, signo menos tipográfico y + opcional', () => {
  assert.equal(formatearPorcentaje(12.345), '12,3 %');
  assert.equal(formatearPorcentaje(2, { signo: true }), '+2,0 %');
  assert.equal(formatearPorcentaje(-2, { signo: true }), '−2,0 %');
  assert.equal(formatearPorcentaje(null), '—');
});

test('dólares con el símbolo local', () => {
  assert.equal(formatearDolares(1234.5), 'US$ 1.234,50');
});

test('fechas en español', () => {
  assert.equal(formatearFecha('2026-11-13'), '13 nov 2026');
  assert.equal(formatearMes('2026-10-31'), 'octubre 2026');
});

test('leerMonto entiende cómo escribimos los montos en Argentina', () => {
  assert.equal(leerMonto('1.500.000'), 1500000);
  assert.equal(leerMonto('1500000'), 1500000);
  assert.equal(leerMonto('1.500,50'), 1500.5);
  assert.equal(leerMonto('$ 350.000'), 350000);
  assert.equal(leerMonto('2.5'), 2.5);
  assert.equal(leerMonto(''), null);
  assert.equal(leerMonto('abc'), null);
});

test('ticksLindos devuelve números redondos que cubren el rango', () => {
  const ticks = ticksLindos(873, 1462);
  assert.ok(ticks[0] <= 873 && ticks.at(-1) >= 1462);
  assert.ok(ticks.length >= 3 && ticks.length <= 7);
});
