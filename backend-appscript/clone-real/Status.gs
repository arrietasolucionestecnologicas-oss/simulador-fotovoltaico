/**
 * Fase A — Paso 6: enum de estados normativos/técnicos (ENGINEERING.md, sección "ESTADOS
 * NORMATIVOS") y adaptador desde los booleanos que ya existen en el motor legacy.
 *
 * Esta fase NO reemplaza los booleanos existentes en Code.gs (`compatible`, `dentroDeAGPE`, etc.)
 * — eso es un cambio de comportamiento de fases posteriores. Aquí solo se crea el vocabulario y
 * el adaptador para que el código nuevo pueda empezar a usarlo sin tocar el legacy.
 */
const STATUS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARNING: 'WARNING',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  UNKNOWN: 'UNKNOWN'
});

/**
 * Convierte un booleano legacy (p.ej. `verificacionString.compatible`) en uno de los estados de
 * STATUS. `opciones.siFalso` permite usar WARNING o REQUIRES_REVIEW en vez de FAIL cuando el
 * booleano legacy no distinguía esos casos (el legacy solo sabe true/false, nunca "no sé").
 */
function legacyBooleanToStatus(valorBooleano, opciones) {
  const cfg = opciones || {};
  if (valorBooleano === null || valorBooleano === undefined) return STATUS.UNKNOWN;
  if (valorBooleano === true) return cfg.siVerdadero || STATUS.PASS;
  return cfg.siFalso || STATUS.FAIL;
}
