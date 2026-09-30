/**
 * Fase A — Paso 4: el motor actual conservado como "legacyCalculationEngine".
 *
 * Esto NO es una reimplementación — es un alias directo a `calcularSistema()` (definida en
 * Code.gs, sin cambios). Existe para que fases futuras puedan comparar
 * `legacyCalculationEngine(datos)` contra un motor nuevo sin ambigüedad sobre cuál código es
 * "el legacy". Ninguna fórmula, constante ni selección de equipos vive en este archivo.
 */
function legacyCalculationEngine(datos) {
  return calcularSistema(datos);
}
