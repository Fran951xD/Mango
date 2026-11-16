// Los tipos de dólar, en el orden y con las palabras que usa la gente.

export const CASAS = [
  { casa: 'oficial', nombre: 'Oficial', ayuda: 'El de los bancos', historico: 'oficial' },
  { casa: 'blue', nombre: 'Blue', ayuda: 'El informal, en cuevas y arbolitos', historico: 'blue' },
  { casa: 'bolsa', nombre: 'MEP', ayuda: 'Comprando bonos desde tu banco o broker', historico: 'bolsa' },
  { casa: 'contadoconliqui', nombre: 'CCL', ayuda: 'Como el MEP, pero cobrás afuera' },
  { casa: 'cripto', nombre: 'Cripto', ayuda: 'Con stablecoins en exchanges' },
  { casa: 'tarjeta', nombre: 'Tarjeta', ayuda: 'Lo que pagás por consumos en el exterior' },
  { casa: 'mayorista', nombre: 'Mayorista', ayuda: 'Entre bancos y empresas' },
];

export const casaPorClave = new Map(CASAS.map((c) => [c.casa, c]));

/** Tipos que sirven para el conversor (el mayorista no es accesible para personas). */
export const CASAS_CONVERSOR = ['oficial', 'blue', 'bolsa', 'contadoconliqui', 'cripto', 'tarjeta'];
