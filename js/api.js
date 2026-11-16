// Capa de datos: APIs públicas con caché local y respaldo, para que la página nunca quede vacía.

import { normalizarSerie, normalizarTasa } from './calc.js';

const DOLAR_API = 'https://dolarapi.com/v1';
const ARG_DATOS = 'https://api.argentinadatos.com/v1';
const MIN = 60 * 1000;
const HORA = 60 * MIN;

/** Cada fuente con su dirección y cuánto tiempo sirve la copia guardada. */
export const FUENTES = {
  actuales: { url: `${DOLAR_API}/dolares`, ttl: 5 * MIN, nombre: 'cotizaciones de hoy' },
  oficial: { url: `${ARG_DATOS}/cotizaciones/dolares/oficial`, ttl: 6 * HORA, nombre: 'histórico del oficial' },
  blue: { url: `${ARG_DATOS}/cotizaciones/dolares/blue`, ttl: 6 * HORA, nombre: 'histórico del blue' },
  bolsa: { url: `${ARG_DATOS}/cotizaciones/dolares/bolsa`, ttl: 6 * HORA, nombre: 'histórico del MEP' },
  uva: { url: `${ARG_DATOS}/finanzas/indices/uva`, ttl: 12 * HORA, nombre: 'índice UVA' },
  inflacion: { url: `${ARG_DATOS}/finanzas/indices/inflacion`, ttl: 12 * HORA, nombre: 'inflación mensual' },
  inflacionInteranual: { url: `${ARG_DATOS}/finanzas/indices/inflacionInteranual`, ttl: 12 * HORA, nombre: 'inflación interanual' },
  riesgoPais: { url: `${ARG_DATOS}/finanzas/indices/riesgo-pais`, ttl: 6 * HORA, nombre: 'riesgo país' },
  plazoFijo: { url: `${ARG_DATOS}/finanzas/tasas/plazoFijo`, ttl: 6 * HORA, nombre: 'tasas de plazo fijo' },
  rendimientos: { url: `${ARG_DATOS}/finanzas/rendimientos`, ttl: 6 * HORA, nombre: 'rendimientos de billeteras' },
};

const PREFIJO = 'mango:v1:';

// localStorage puede no estar disponible (modo privado, cuota llena): nunca rompe la app.
const almacen = {
  leer(clave) {
    try {
      const crudo = localStorage.getItem(PREFIJO + clave);
      return crudo ? JSON.parse(crudo) : null;
    } catch {
      return null;
    }
  },
  guardar(clave, datos) {
    try {
      localStorage.setItem(PREFIJO + clave, JSON.stringify({ guardado: Date.now(), datos }));
    } catch {
      /* sin caché seguimos igual */
    }
  },
};

async function pedirJSON(url, { timeout = 12000 } = {}) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), timeout);
  try {
    const respuesta = await fetch(url, { signal: control.signal, headers: { Accept: 'application/json' } });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return await respuesta.json();
  } finally {
    clearTimeout(reloj);
  }
}

let demo = null;
const cargarDemo = () => (demo ??= pedirJSON(new URL('../data/demo.json', import.meta.url).href, { timeout: 20000 }));

/**
 * Prioridad: caché vigente → API → caché vencida → datos de ejemplo.
 * Devuelve { datos, origen, guardado } con origen 'cache' | 'vivo' | 'cache-vencida' | 'demo'.
 */
export async function obtener(clave, { forzarDemo = false, ignorarCache = false } = {}) {
  if (forzarDemo) return { datos: (await cargarDemo())[clave], origen: 'demo' };
  const { url, ttl } = FUENTES[clave];
  const copia = almacen.leer(clave);
  if (!ignorarCache && copia && Date.now() - copia.guardado < ttl) {
    return { datos: copia.datos, origen: 'cache', guardado: copia.guardado };
  }
  try {
    const datos = await pedirJSON(url);
    if (Array.isArray(datos) && datos.length === 0) throw new Error('respuesta vacía');
    almacen.guardar(clave, datos);
    return { datos, origen: 'vivo', guardado: Date.now() };
  } catch (error) {
    console.warn(`[mango] ${clave}: ${error.message}`);
    if (copia) return { datos: copia.datos, origen: 'cache-vencida', guardado: copia.guardado };
    return { datos: (await cargarDemo())[clave], origen: 'demo' };
  }
}

/** Tasas de plazo fijo en un formato uniforme, de mayor a menor. */
function prepararPlazoFijo(lista) {
  return (lista ?? [])
    .map((b) => ({
      entidad: String(b.entidad ?? '').trim(),
      tnaClientes: normalizarTasa(b.tnaClientes),
      tnaNoClientes: normalizarTasa(b.tnaNoClientes),
      enlace: typeof b.enlace === 'string' && /^https?:\/\//.test(b.enlace) ? b.enlace : null,
    }))
    .filter((b) => b.entidad && (b.tnaClientes || b.tnaNoClientes))
    .sort((a, b) => (b.tnaClientes ?? b.tnaNoClientes) - (a.tnaClientes ?? a.tnaNoClientes));
}

/** Rendimiento en pesos (APY) de billeteras y cuentas, el dato más reciente de cada una. */
function prepararRendimientos(lista) {
  return (lista ?? [])
    .map((e) => {
      const enPesos = (e.rendimientos ?? []).filter((r) => r.moneda === 'ARS').sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
      return enPesos ? { entidad: String(e.entidad ?? '').trim(), apy: normalizarTasa(enPesos.apy), fecha: enPesos.fecha } : null;
    })
    .filter((e) => e?.entidad && e.apy)
    .sort((a, b) => b.apy - a.apy);
}

/** Pide todo en paralelo. Cada fuente que falla cae a su respaldo sin frenar a las demás. */
export async function obtenerTodo(opciones = {}) {
  const claves = Object.keys(FUENTES);
  const resultados = await Promise.all(claves.map((c) => obtener(c, opciones)));
  const r = Object.fromEntries(claves.map((c, i) => [c, resultados[i]]));
  const historico = (clave) => ({
    venta: normalizarSerie(r[clave].datos, 'venta'),
    compra: normalizarSerie(r[clave].datos, 'compra'),
  });

  return {
    actuales: (r.actuales.datos ?? []).filter((d) => Number(d?.venta) > 0),
    historico: { oficial: historico('oficial'), blue: historico('blue'), bolsa: historico('bolsa') },
    uva: normalizarSerie(r.uva.datos),
    inflacion: normalizarSerie(r.inflacion.datos),
    inflacionInteranual: normalizarSerie(r.inflacionInteranual.datos),
    riesgoPais: normalizarSerie(r.riesgoPais.datos),
    plazoFijo: prepararPlazoFijo(r.plazoFijo.datos),
    rendimientos: prepararRendimientos(r.rendimientos.datos),
    origenes: Object.fromEntries(claves.map((c) => [c, r[c].origen])),
  };
}
