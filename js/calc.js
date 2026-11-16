// Funciones puras de cálculo. No tocan el DOM ni la red, así se pueden testear con `node --test`.

/** Brecha porcentual de `valor` respecto de `referencia` (ej: blue vs oficial). */
export function brecha(valor, referencia) {
  if (!Number.isFinite(valor) || !Number.isFinite(referencia) || referencia === 0) return null;
  return (valor / referencia - 1) * 100;
}

/** Variación porcentual entre un valor inicial y uno final. */
export function variacion(inicial, final) {
  return brecha(final, inicial);
}

/**
 * Inflación acumulada a partir de tasas mensuales en %.
 * Ej: [2, 3] => (1.02 * 1.03 - 1) * 100 = 5.06
 */
export function inflacionAcumulada(tasasMensuales) {
  if (!tasasMensuales.length) return null;
  const factor = tasasMensuales.reduce((acc, t) => acc * (1 + t / 100), 1);
  return (factor - 1) * 100;
}

/**
 * Variación real: cuánto cambió algo descontando la inflación del mismo período.
 * Positivo = le ganó a la inflación.
 */
export function variacionReal(variacionNominal, inflacion) {
  if (variacionNominal == null || inflacion == null) return null;
  return ((1 + variacionNominal / 100) / (1 + inflacion / 100) - 1) * 100;
}

/** Normaliza una serie de la API a [{ fecha: 'YYYY-MM-DD', valor }], ordenada y sin fechas repetidas. */
export function normalizarSerie(items, campoValor = 'valor') {
  const porFecha = new Map();
  for (const item of items ?? []) {
    const valor = Number(item?.[campoValor]);
    const fecha = String(item?.fecha ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(valor)) continue;
    porFecha.set(fecha, valor); // si hay repetidos, gana el último
  }
  return [...porFecha.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([fecha, valor]) => ({ fecha, valor }));
}

/** Resta `meses` a una fecha ISO y devuelve otra fecha ISO. */
export function restarMeses(fechaISO, meses) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1 - meses, 1));
  const ultimoDia = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0)).getUTCDate();
  fecha.setUTCDate(Math.min(d, ultimoDia));
  return fecha.toISOString().slice(0, 10);
}

/** Filtra una serie a los últimos `meses` meses tomando como fin la última fecha de la serie. `null` = toda la serie. */
export function filtrarPorRango(serie, meses, fechaFin = serie.at(-1)?.fecha) {
  if (meses == null || !fechaFin) return serie;
  const desde = restarMeses(fechaFin, meses);
  return serie.filter((p) => p.fecha >= desde && p.fecha <= fechaFin);
}

/**
 * Como filtrarPorRango, pero arranca en el último dato disponible en o antes de la fecha de inicio.
 * Sirve para comparar períodos completos (ej: del cierre de junio al cierre de septiembre).
 */
export function tramoComparable(serie, meses, fechaFin = serie.at(-1)?.fecha) {
  const hastaFin = serie.filter((p) => p.fecha <= fechaFin);
  if (meses == null || !hastaFin.length) return hastaFin;
  const desde = restarMeses(fechaFin, meses);
  let inicio = hastaFin.findLastIndex((p) => p.fecha <= desde);
  if (inicio === -1) inicio = 0;
  return hastaFin.slice(inicio);
}

/**
 * Une dos series por fecha. Si a una le falta un día (feriado, sin dato), usa su último valor conocido.
 * Devuelve [{ fecha, a, b }] solo desde que ambas tienen datos.
 */
export function unirPorFecha(serieA, serieB) {
  const mapaA = new Map(serieA.map((p) => [p.fecha, p.valor]));
  const mapaB = new Map(serieB.map((p) => [p.fecha, p.valor]));
  const fechas = [...new Set([...mapaA.keys(), ...mapaB.keys()])].sort();
  const resultado = [];
  let ultimoA = null;
  let ultimoB = null;
  for (const fecha of fechas) {
    if (mapaA.has(fecha)) ultimoA = mapaA.get(fecha);
    if (mapaB.has(fecha)) ultimoB = mapaB.get(fecha);
    if (ultimoA != null && ultimoB != null) resultado.push({ fecha, a: ultimoA, b: ultimoB });
  }
  return resultado;
}

/** Serie histórica de la brecha de `serie` respecto de `referencia`. */
export function serieBrecha(serie, referencia) {
  return unirPorFecha(serie, referencia).map(({ fecha, a, b }) => ({ fecha, valor: brecha(a, b) }));
}

/** Reduce la cantidad de puntos para dibujar rápido, conservando siempre el primero y el último. */
export function reducirPuntos(serie, maximo = 400) {
  if (serie.length <= maximo) return serie;
  const paso = (serie.length - 1) / (maximo - 1);
  const resultado = [];
  for (let i = 0; i < maximo; i++) resultado.push(serie[Math.round(i * paso)]);
  return resultado;
}

/**
 * ¿El dólar le ganó a la inflación en el período?
 * Compara la suba del dólar entre la primera y la última fecha con la inflación acumulada
 * de los meses completos de ese período.
 */
export function dolarVsInflacion(serieDolar, inflacionMensual) {
  if (serieDolar.length < 2) return null;
  const inicio = serieDolar[0];
  const fin = serieDolar.at(-1);
  const mesInicio = inicio.fecha.slice(0, 7);
  const mesFin = fin.fecha.slice(0, 7);
  // Meses posteriores al de inicio y hasta el de fin (incluido) que tengan dato publicado.
  const meses = inflacionMensual.filter((p) => {
    const mes = p.fecha.slice(0, 7);
    return mes > mesInicio && mes <= mesFin;
  });
  if (!meses.length) return null;
  const subaDolar = variacion(inicio.valor, fin.valor);
  const inflacion = inflacionAcumulada(meses.map((p) => p.valor));
  return {
    desde: inicio.fecha,
    hasta: fin.fecha,
    mesesConInflacion: meses.length,
    ultimoMesInflacion: meses.at(-1).fecha.slice(0, 7),
    subaDolar,
    inflacion,
    real: variacionReal(subaDolar, inflacion),
  };
}

// ---------------------------------------------------------------------------
// Herramientas de Mango
// ---------------------------------------------------------------------------

/** Último valor disponible en o antes de `fecha`. Devuelve el punto { fecha, valor } o null. */
export function valorEnFecha(serie, fecha) {
  let encontrado = null;
  for (const punto of serie) {
    if (punto.fecha > fecha) break;
    encontrado = punto;
  }
  return encontrado;
}

/**
 * Lleva un monto de un mes a otro según la inflación mensual.
 * Un precio de marzo, expresado en pesos de septiembre, acumula la inflación de abril a septiembre.
 * Si `hastaMes` es anterior a `desdeMes`, descuenta la inflación (va hacia atrás).
 * Meses en formato 'YYYY-MM'.
 */
export function ajustarPorInflacion(monto, inflacionMensual, desdeMes, hastaMes) {
  if (!Number.isFinite(monto) || !desdeMes || !hastaMes) return null;
  const haciaAdelante = hastaMes >= desdeMes;
  const [inicio, fin] = haciaAdelante ? [desdeMes, hastaMes] : [hastaMes, desdeMes];
  const meses = inflacionMensual.filter((p) => {
    const mes = p.fecha.slice(0, 7);
    return mes > inicio && mes <= fin;
  });
  const factorAcumulado = meses.reduce((acc, p) => acc * (1 + p.valor / 100), 1);
  const factor = haciaAdelante ? factorAcumulado : 1 / factorAcumulado;
  return {
    resultado: monto * factor,
    factor,
    porcentaje: (factor - 1) * 100,
    meses: meses.length,
    recorrido: meses.map((p) => ({ fecha: p.fecha, valor: p.valor })),
  };
}

/**
 * Cuánto valdría hoy una inversión hecha en `desde` con `monto` pesos.
 * `serieCompra` es el precio al que comprás (venta de la casa), `serieVenta` al que vendés (compra de la casa).
 * Si no hay serie de venta, se usa la misma (ej: UVA).
 * Devuelve el valor final y la evolución diaria del valor en pesos.
 */
export function simularInversion(monto, desde, serieCompra, serieVenta = serieCompra) {
  const entrada = valorEnFecha(serieCompra, desde) ?? (serieCompra[0]?.fecha >= desde ? serieCompra[0] : null);
  if (!entrada || !(monto > 0)) return null;
  const unidades = monto / entrada.valor;
  const evolucion = serieVenta
    .filter((p) => p.fecha >= entrada.fecha)
    .map((p) => ({ fecha: p.fecha, valor: unidades * p.valor }));
  if (!evolucion.length) return null;
  const final = evolucion.at(-1);
  return {
    desde: entrada.fecha,
    hasta: final.fecha,
    precioEntrada: entrada.valor,
    unidades,
    valorFinal: final.valor,
    variacion: variacion(monto, final.valor),
    evolucion,
  };
}

/** Las tasas pueden venir como decimal (0.32) o como porcentaje (32). Siempre devuelve porcentaje. */
export function normalizarTasa(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return numero < 1 ? numero * 100 : numero;
}

/** Interés simple de un plazo fijo tradicional: monto × TNA × días / 365. */
export function interesPlazoFijo(monto, tna, dias = 30) {
  if (!(monto > 0) || !(tna > 0) || !(dias > 0)) return null;
  return (monto * (tna / 100) * dias) / 365;
}

/** Tasa efectiva anual de renovar un plazo fijo cada `dias` días con la misma TNA. */
export function teaDesdeTna(tna, dias = 30) {
  if (!(tna > 0)) return null;
  return ((1 + ((tna / 100) * dias) / 365) ** (365 / dias) - 1) * 100;
}

/** Rendimiento efectivo de un período de `dias` días a partir de una tasa anual efectiva (APY/TEA). */
export function rendimientoPeriodoDesdeTea(tea, dias = 30) {
  if (!(tea > 0)) return null;
  return ((1 + tea / 100) ** (dias / 365) - 1) * 100;
}

/** Tasa mensual equivalente a una anual compuesta (para comparar con la inflación mensual). */
export function mensualDesdeAnual(anualPct) {
  if (anualPct == null) return null;
  return ((1 + anualPct / 100) ** (1 / 12) - 1) * 100;
}

/** Convierte un monto entre pesos y dólares usando el precio que corresponde a cada operación. */
export function convertir(monto, { compra, venta }, direccion) {
  if (!(monto >= 0)) return null;
  // Para comprar dólares pagás el precio de venta; al vender dólares te pagan el de compra.
  if (direccion === 'ars-usd') return venta > 0 ? monto / venta : null;
  return compra > 0 ? monto * compra : venta > 0 ? monto * venta : null;
}
