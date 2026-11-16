// Punto de entrada: carga los datos una vez y se los reparte a cada herramienta.

import { FUENTES, obtenerTodo } from './api.js';
import { iniciarAhorro, actualizarAhorro } from './ui/ahorro.js';
import { iniciarConversor, actualizarConversor } from './ui/conversor.js';
import { $ } from './ui/dom.js';
import { iniciarInflacion, actualizarInflacion } from './ui/inflacion.js';
import { iniciarMercado, actualizarMercado } from './ui/mercado.js';
import { renderPizarra } from './ui/pizarra.js';
import { iniciarTasas, actualizarTasas } from './ui/tasas.js';

const forzarDemo = new URLSearchParams(location.search).get('demo') === '1';
const AUTO_REFRESCO = 5 * 60 * 1000;

function renderEstado(origenes) {
  const enDemo = Object.keys(origenes).filter((c) => origenes[c] === 'demo');
  const vencidas = Object.keys(origenes).filter((c) => origenes[c] === 'cache-vencida');
  const indicador = $('#estado');
  const aviso = $('#aviso');
  const texto = $('#aviso-texto');
  const nombres = (claves) => claves.map((c) => FUENTES[c].nombre).join(', ');

  if (enDemo.length) {
    indicador.dataset.estado = 'demo';
    indicador.textContent = 'Datos de ejemplo';
    texto.textContent = forzarDemo
      ? 'Estás viendo datos de ejemplo, no reales. Quitá "?demo=1" de la dirección para ver los datos del día.'
      : enDemo.length === Object.keys(origenes).length
        ? 'No pudimos conectarnos con las fuentes de datos. Lo que ves son datos de ejemplo, no reales. Tocá "Reintentar" en unos minutos.'
        : `No respondieron estas fuentes: ${nombres(enDemo)}. En esas partes ves datos de ejemplo, no reales.`;
    aviso.hidden = false;
  } else if (vencidas.length) {
    indicador.dataset.estado = 'vivo';
    indicador.textContent = 'En vivo';
    texto.textContent = `No respondieron estas fuentes: ${nombres(vencidas)}. Mostramos la última copia guardada.`;
    aviso.hidden = false;
  } else {
    indicador.dataset.estado = 'vivo';
    indicador.textContent = 'En vivo';
    aviso.hidden = true;
  }
}

let cargando = false;
async function cargar({ ignorarCache = false } = {}) {
  if (cargando) return;
  cargando = true;
  document.body.classList.add('actualizando');
  const boton = $('#reintentar');
  boton.disabled = true;
  try {
    const datos = await obtenerTodo({ forzarDemo, ignorarCache });
    renderEstado(datos.origenes);
    renderPizarra(datos);
    actualizarConversor(datos.actuales);
    actualizarInflacion(datos.inflacion);
    actualizarAhorro(datos);
    actualizarTasas(datos);
    actualizarMercado(datos);
  } catch (error) {
    console.error(error);
    $('#estado').dataset.estado = 'error';
    $('#estado').textContent = 'Sin conexión';
    $('#aviso-texto').textContent = 'No se pudieron cargar los datos. Revisá tu conexión y tocá "Reintentar".';
    $('#aviso').hidden = false;
  } finally {
    document.body.classList.remove('actualizando');
    boton.disabled = false;
    cargando = false;
  }
}

iniciarConversor();
iniciarInflacion();
iniciarAhorro();
iniciarTasas();
iniciarMercado();
$('#reintentar').addEventListener('click', () => cargar({ ignorarCache: true }));

// La pizarra se refresca sola mientras la pestaña está a la vista.
setInterval(() => {
  if (document.visibilityState === 'visible' && !forzarDemo) cargar();
}, AUTO_REFRESCO);

cargar();
