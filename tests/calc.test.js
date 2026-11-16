import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  brecha, dolarVsInflacion, filtrarPorRango, inflacionAcumulada, normalizarSerie, reducirPuntos,
  restarMeses, serieBrecha, tramoComparable, unirPorFecha, variacionReal,
} from '../js/calc.js';

const cerca = (real, esperado, tolerancia = 1e-9) =>
  assert.ok(Math.abs(real - esperado) < tolerancia, `${real} no es ≈ ${esperado}`);

test('brecha: blue 1100 vs oficial 1000 = 10 %', () => {
  cerca(brecha(1100, 1000), 10);
  cerca(brecha(900, 1000), -10);
});

test('brecha: devuelve null con datos inválidos', () => {
  assert.equal(brecha(1000, 0), null);
  assert.equal(brecha(undefined, 1000), null);
  assert.equal(brecha(NaN, 1000), null);
});

test('inflacionAcumulada compone las tasas (no las suma)', () => {
  cerca(inflacionAcumulada([2, 3]), 5.06);
  cerca(inflacionAcumulada(Array(12).fill(1)), 12.682503013196977);
  assert.equal(inflacionAcumulada([]), null);
});

test('variacionReal: subir 10 % con 10 % de inflación es 0 % real', () => {
  cerca(variacionReal(10, 10), 0);
  cerca(variacionReal(21, 10), 10);
  assert.ok(variacionReal(5, 10) < 0);
});

test('normalizarSerie ordena, elimina repetidos e ignora datos rotos', () => {
  const serie = normalizarSerie([
    { fecha: '2026-01-03', venta: 30 },
    { fecha: '2026-01-01', venta: 10 },
    { fecha: '2026-01-03', venta: 33 },
    { fecha: 'basura', venta: 1 },
    { fecha: '2026-01-02', venta: 'n/a' },
  ], 'venta');
  assert.deepEqual(serie, [
    { fecha: '2026-01-01', valor: 10 },
    { fecha: '2026-01-03', valor: 33 },
  ]);
});

test('normalizarSerie tolera null/undefined', () => {
  assert.deepEqual(normalizarSerie(undefined), []);
});

test('restarMeses respeta fin de mes', () => {
  assert.equal(restarMeses('2026-03-31', 1), '2026-02-28');
  assert.equal(restarMeses('2024-03-31', 1), '2024-02-29');
  assert.equal(restarMeses('2026-01-15', 2), '2025-11-15');
  assert.equal(restarMeses('2026-11-13', 12), '2025-11-13');
});

test('filtrarPorRango: null devuelve todo, N meses recorta desde el final', () => {
  const serie = [
    { fecha: '2025-01-10', valor: 1 },
    { fecha: '2025-06-10', valor: 2 },
    { fecha: '2025-12-10', valor: 3 },
  ];
  assert.equal(filtrarPorRango(serie, null).length, 3);
  assert.deepEqual(filtrarPorRango(serie, 6).map((p) => p.valor), [2, 3]);
  assert.deepEqual(filtrarPorRango(serie, 1).map((p) => p.valor), [3]);
});

test('tramoComparable arranca en el último dato previo al inicio', () => {
  const serie = [
    { fecha: '2026-06-27', valor: 100 }, // viernes, último dato de junio
    { fecha: '2026-07-01', valor: 101 },
    { fecha: '2026-09-30', valor: 110 },
    { fecha: '2026-10-15', valor: 120 }, // posterior al fin: se descarta
  ];
  const tramo = tramoComparable(serie, 3, '2026-09-30');
  assert.deepEqual(tramo.map((p) => p.fecha), ['2026-06-27', '2026-07-01', '2026-09-30']);
});

test('unirPorFecha completa huecos con el último valor conocido', () => {
  const a = [{ fecha: 'd1', valor: 1 }, { fecha: 'd2', valor: 2 }, { fecha: 'd3', valor: 3 }];
  const b = [{ fecha: 'd2', valor: 20 }];
  assert.deepEqual(unirPorFecha(a, b), [
    { fecha: 'd2', a: 2, b: 20 },
    { fecha: 'd3', a: 3, b: 20 },
  ]);
});

test('serieBrecha calcula la brecha día por día', () => {
  const blue = [{ fecha: '2026-01-01', valor: 1500 }, { fecha: '2026-01-02', valor: 1200 }];
  const oficial = [{ fecha: '2026-01-01', valor: 1000 }, { fecha: '2026-01-02', valor: 1000 }];
  const s = serieBrecha(blue, oficial);
  cerca(s[0].valor, 50);
  cerca(s[1].valor, 20);
});

test('reducirPuntos conserva extremos y respeta el máximo', () => {
  const serie = Array.from({ length: 1000 }, (_, i) => ({ fecha: String(i), valor: i }));
  const reducida = reducirPuntos(serie, 100);
  assert.equal(reducida.length, 100);
  assert.equal(reducida[0].valor, 0);
  assert.equal(reducida.at(-1).valor, 999);
  assert.equal(reducirPuntos(serie.slice(0, 10), 100).length, 10);
});

test('dolarVsInflacion usa solo los meses posteriores al inicio', () => {
  const dolar = [
    { fecha: '2026-06-30', valor: 1000 },
    { fecha: '2026-09-30', valor: 1100 },
  ];
  const inflacion = [
    { fecha: '2026-06-30', valor: 99 }, // mes de inicio: no cuenta
    { fecha: '2026-07-31', valor: 2 },
    { fecha: '2026-08-31', valor: 2 },
    { fecha: '2026-09-30', valor: 2 },
    { fecha: '2026-10-31', valor: 99 }, // posterior: no cuenta
  ];
  const r = dolarVsInflacion(dolar, inflacion);
  assert.equal(r.mesesConInflacion, 3);
  cerca(r.subaDolar, 10);
  cerca(r.inflacion, 6.1208);
  assert.ok(r.real > 0, 'el dólar debería haberle ganado a la inflación');
});

test('dolarVsInflacion devuelve null si no alcanza la información', () => {
  assert.equal(dolarVsInflacion([{ fecha: '2026-01-01', valor: 1 }], []), null);
  assert.equal(dolarVsInflacion([{ fecha: '2026-01-01', valor: 1 }, { fecha: '2026-01-20', valor: 2 }], []), null);
});
