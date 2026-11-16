// Utilidades de DOM compartidas por las herramientas.

import { formatearEntrada, leerMonto } from '../format.js';

export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

/** Crea un elemento. `hijos` puede incluir strings (se insertan como texto, nunca como HTML). */
export function el(tag, atributos = {}, ...hijos) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos)) {
    if (v == null || v === false) continue;
    if (k === 'class') nodo.className = v;
    else if (k === 'dataset') Object.assign(nodo.dataset, v);
    else if (k.startsWith('on')) nodo.addEventListener(k.slice(2), v);
    else nodo.setAttribute(k, v === true ? '' : v);
  }
  nodo.append(...hijos.flat().filter((h) => h != null && h !== false));
  return nodo;
}

/**
 * Campo de monto: acepta "1.500.000", "1500000" o "1.500,50", y al salir lo reescribe prolijo.
 * Llama a `alCambiar(numero)` con cada tecla.
 */
export function campoMonto(input, alCambiar) {
  const emitir = () => alCambiar(leerMonto(input.value));
  input.addEventListener('input', emitir);
  input.addEventListener('blur', () => {
    const numero = leerMonto(input.value);
    if (numero != null) input.value = formatearEntrada(numero);
  });
  input.addEventListener('focus', () => input.select());
  return { leer: () => leerMonto(input.value), escribir: (n) => (input.value = formatearEntrada(n)) };
}

/**
 * Grupo de opciones con el patrón de radio de WAI-ARIA: Tab entra al grupo, flechas cambian la opción.
 * Los botones necesitan `data-valor`.
 */
export function grupoRadio(contenedor, alCambiar) {
  const botones = () => $$('[role="radio"]', contenedor);
  const seleccionar = (boton, { avisar = true, enfocar = false } = {}) => {
    for (const b of botones()) {
      const activo = b === boton;
      b.setAttribute('aria-checked', String(activo));
      b.tabIndex = activo ? 0 : -1;
    }
    if (enfocar) boton.focus();
    if (avisar) alCambiar(boton.dataset.valor);
  };
  contenedor.addEventListener('click', (e) => {
    const boton = e.target.closest('[role="radio"]');
    if (boton && boton.getAttribute('aria-checked') !== 'true') seleccionar(boton);
  });
  contenedor.addEventListener('keydown', (e) => {
    const lista = botones();
    const actual = lista.indexOf(document.activeElement);
    if (actual === -1) return;
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (delta) {
      e.preventDefault();
      seleccionar(lista[(actual + delta + lista.length) % lista.length], { enfocar: true });
    }
  });
  const inicial = botones().find((b) => b.getAttribute('aria-checked') === 'true') ?? botones()[0];
  if (inicial) seleccionar(inicial, { avisar: false });
  return {
    elegir(valor, opciones) {
      const boton = botones().find((b) => b.dataset.valor === valor);
      if (boton) seleccionar(boton, opciones);
    },
  };
}

/** Pestañas con el patrón de WAI-ARIA (activación automática con flechas). */
export function pestanias(lista, alCambiar) {
  const tabs = $$('[role="tab"]', lista);
  const activar = (tab, enfocar = false) => {
    for (const t of tabs) {
      const activa = t === tab;
      t.setAttribute('aria-selected', String(activa));
      t.tabIndex = activa ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !activa;
    }
    if (enfocar) tab.focus();
    alCambiar?.(tab.dataset.valor);
  };
  lista.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) activar(tab);
  });
  lista.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (destino == null || i === -1) return;
    e.preventDefault();
    activar(tabs[(destino + tabs.length) % tabs.length], true);
  });
  activar(tabs.find((t) => t.getAttribute('aria-selected') === 'true') ?? tabs[0]);
}

/** Copia texto al portapapeles y confirma en el mismo botón. */
export async function copiar(texto, boton) {
  const original = boton.textContent;
  try {
    await navigator.clipboard.writeText(texto);
    boton.textContent = 'Copiado';
  } catch {
    boton.textContent = 'No se pudo copiar';
  }
  setTimeout(() => (boton.textContent = original), 1800);
}

/** Lee y escribe parámetros de la URL sin recargar, para poder compartir un cálculo. */
export const url = {
  leer: (clave) => new URLSearchParams(location.search).get(clave),
  escribir(cambios) {
    const direccion = new URL(location.href);
    for (const [k, v] of Object.entries(cambios)) {
      if (v == null || v === '') direccion.searchParams.delete(k);
      else direccion.searchParams.set(k, v);
    }
    history.replaceState(null, '', direccion);
    return direccion.href;
  },
};

/** Preferencias livianas del visitante (último tipo de dólar elegido, etc.). */
export const preferencias = {
  leer(clave, porDefecto) {
    try {
      return JSON.parse(localStorage.getItem(`mango:pref:${clave}`)) ?? porDefecto;
    } catch {
      return porDefecto;
    }
  },
  guardar(clave, valor) {
    try {
      localStorage.setItem(`mango:pref:${clave}`, JSON.stringify(valor));
    } catch {
      /* sin preferencias guardadas */
    }
  },
};
