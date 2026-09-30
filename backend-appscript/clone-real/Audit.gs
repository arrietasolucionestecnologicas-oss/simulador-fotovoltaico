/**
 * Fase A — Paso 5: capa de auditoría (ENGINEERING.md, sección "AUDITORÍA").
 *
 * `auditarResultadoLegacy_` NO vuelve a calcular nada — solo LEE campos que
 * `calcularSistema()` (Code.gs) ya produjo, y los empaqueta como AuditEntry. Esto es
 * deliberado: duplicar una fórmula aquí para "auditarla" sería la forma más fácil de que
 * esta fase, sin querer, cambie o desincronice un resultado. Por eso solo se instrumentan
 * los 3 chequeos que ya están 100% expuestos en el objeto `resultado` existente. El filtro
 * de banda de potencia del inversor (±30%) NO se audita todavía porque hoy sucede dentro del
 * filtrado de candidatos en `calcularSistema` y no queda expuesto en el resultado final sin
 * recalcularlo — eso es tarea de una fase futura, cuando el motor exponga explícitamente los
 * candidatos descartados (ver GAP-ANALYSIS.md, punto 19).
 *
 * Donde el código legacy no cita una norma específica, se usa 'LEGACY_UNDOCUMENTED' en vez de
 * inventar una fuente — así lo pide ENGINEERING.md explícitamente.
 */

function crearAuditEntry_(campos) {
  return {
    check: campos.check,
    result: campos.result,
    calculated: campos.calculated,
    limit: campos.limit,
    unit: campos.unit,
    formula: campos.formula,
    source: campos.source,
    engineVersion: 'legacy-fase1',
    timestamp: new Date().toISOString()
  };
}

/**
 * resultado: la salida de `calcularSistema()` (o `legacyCalculationEngine()`), sin modificar.
 * Devuelve un array de AuditEntry. No lanza error si `resultado` viene de un caso
 * fueraDeAlcanceAGPE o sin combinaciones compatibles — en esos casos devuelve las entradas que
 * sí se puedan derivar (puede ser un array corto o vacío).
 */
function auditarResultadoLegacy_(resultado) {
  const entradas = [];

  if (resultado.fueraDeAlcanceAGPE) {
    entradas.push(crearAuditEntry_({
      check: 'AGPE_POWER_LIMIT',
      result: STATUS.FAIL,
      calculated: resultado.potenciaAjustadaKwp,
      limit: 1000,
      unit: 'kWp',
      formula: 'potenciaAjustadaKwp > LIMITE_AGPE_KWP',
      source: 'Resolución CREG 174 de 2021 — AGPE, hasta 1 MW en el SDL'
    }));
    return entradas;
  }

  if (resultado.error) {
    // No hay combinación panel+inversor compatible — no hay campos suficientes para auditar
    // el chequeo de string (no se eligió ningún panel/inversor). Se deja constancia del hecho.
    entradas.push(crearAuditEntry_({
      check: 'STRING_COMPATIBILITY',
      result: STATUS.FAIL,
      calculated: null,
      limit: null,
      unit: null,
      formula: 'verificarString_(panel, inversor, temperaturaMinima, numPaneles) para todas las combinaciones del catálogo',
      source: 'LEGACY_UNDOCUMENTED'
    }));
    return entradas;
  }

  if (resultado.regulatorio) {
    entradas.push(crearAuditEntry_({
      check: 'AGPE_POWER_LIMIT',
      result: legacyBooleanToStatus(resultado.regulatorio.dentroDeAGPE),
      calculated: resultado.potenciaAjustadaKwp,
      limit: resultado.regulatorio.limiteAGPEKwp,
      unit: 'kWp',
      formula: 'potenciaAjustadaKwp <= LIMITE_AGPE_KWP',
      source: resultado.regulatorio.referenciaResolucion
    }));
  }

  if (resultado.verificacionString) {
    const vs = resultado.verificacionString;
    entradas.push(crearAuditEntry_({
      check: 'STRING_VOLTAGE_WINDOW',
      result: legacyBooleanToStatus(vs.compatible, { siFalso: STATUS.FAIL }),
      calculated: vs.vocCorregidoV,
      limit: resultado.inversor ? resultado.inversor.voltajeMaxEntradaDC : null,
      unit: 'V',
      formula: 'Voc(T) = Voc_STC * (1 + coefTempVoc/100 * (tMin - 25)); Voc(T) * panelesPorString <= voltajeMaxEntradaDC; dentro de ventana MPPT',
      source: 'LEGACY_UNDOCUMENTED'
    }));

    entradas.push(crearAuditEntry_({
      check: 'STRING_CURRENT_MPPT',
      result: legacyBooleanToStatus(vs.compatible, { siFalso: STATUS.FAIL }),
      calculated: vs.stringsPorMppt,
      limit: vs.maxStringsPorMppt,
      unit: 'strings/MPPT',
      formula: 'fusibleRecomendadoA = Isc_STC * FACTOR_SEGURIDAD_ISC; maxStringsPorMppt = floor(corrienteMaxPorMppt / fusibleRecomendadoA)',
      source: 'NEC 690.8 / RETIE — factor de seguridad 1.25x sobre Isc'
    }));
  }

  return entradas;
}
