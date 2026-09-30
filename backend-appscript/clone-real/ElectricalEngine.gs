/**
 * Fase B — Motor eléctrico correcto (ENGINEERING.md, PARTES 3-7).
 *
 * Código NUEVO y ADITIVO. `calcularSistema()` / `verificarString_()` en Code.gs NO llaman a
 * nada de este archivo todavía — ver "PROBLEMA/IMPACTO/OPCIONES/RECOMENDACIÓN" en
 * docs/PHASE_B_INVENTORY.md sobre por qué conectar esto al camino en vivo es una decisión de
 * producto que necesita autorización explícita (el catálogo real hoy no tiene los datos nuevos
 * que este motor necesita para no reportar REQUIRES_REVIEW en casi todo).
 *
 * Cada `verificar*_` es una función independiente y reutilizable — tanto `enumerarCandidatosString_`
 * como los Golden Cases de Fase B llaman a las MISMAS funciones (no hay una copia "para
 * producción" y otra "para pruebas"). Principio de todo el archivo: si un dato no existe, el
 * chequeo correspondiente devuelve UNKNOWN (o REQUIRES_REVIEW cuando el impacto de no saberlo
 * es relevante) — nunca PASS, nunca un valor inventado.
 */

// ── PARTE 3: Voc en frío y Vmp en caliente (por módulo) ─────────────────────

/** MISMA fórmula que el legacy `verificarString_` (Code.gs) — reexpuesta con trazabilidad. */
function calcularVocFrio_(panel, temperaturaMinima) {
  if (panel.vocStc === undefined || panel.vocStc === null || (!panel.coefTempVoc && panel.coefTempVoc !== 0)) {
    return { status: STATUS.UNKNOWN, calculated: null, formula: 'Voc(T) = Voc_STC * (1 + coefTempVoc/100 * (tMin - 25))', motivo: 'Falta Voc_STC o coefTempVoc en el panel.' };
  }
  if (temperaturaMinima === undefined || temperaturaMinima === null) {
    return { status: STATUS.UNKNOWN, calculated: null, formula: 'Voc(T) = Voc_STC * (1 + coefTempVoc/100 * (tMin - 25))', motivo: 'Falta la temperatura mínima de diseño de la zona.' };
  }
  const vocFrio = panel.vocStc * (1 + (panel.coefTempVoc / 100) * (temperaturaMinima - 25));
  return { status: STATUS.PASS, calculated: round2_(vocFrio), formula: 'Voc(T) = Voc_STC * (1 + coefTempVoc/100 * (tMin - 25))', motivo: null };
}

/**
 * PARTE 3: "No utilizar simplemente Vmp_STC × numeroModulos como sustituto de Vmp caliente."
 * Requiere `panel.coefTempVmp` (PARTE 1) y `temperaturaMaxima` (zona) — ninguno existe todavía
 * en datos reales, así que este chequeo hoy SIEMPRE es UNKNOWN contra el catálogo real. Correcto,
 * no un bug: es la "REGLA DE NO ASUMIR" funcionando.
 */
function calcularVmpCaliente_(panel, temperaturaMaxima) {
  if (panel.vmpStc === undefined || panel.vmpStc === null) {
    return { status: STATUS.UNKNOWN, calculated: null, formula: 'Vmp(T) = Vmp_STC * (1 + coefTempVmp/100 * (tMax - 25))', motivo: 'Falta Vmp_STC en el panel.' };
  }
  if (panel.coefTempVmp === undefined || panel.coefTempVmp === null) {
    return { status: STATUS.UNKNOWN, calculated: null, formula: 'Vmp(T) = Vmp_STC * (1 + coefTempVmp/100 * (tMax - 25))', motivo: 'Falta el coeficiente de temperatura de Vmp en el panel (dato nuevo de Fase B).' };
  }
  if (temperaturaMaxima === undefined || temperaturaMaxima === null) {
    return { status: STATUS.UNKNOWN, calculated: null, formula: 'Vmp(T) = Vmp_STC * (1 + coefTempVmp/100 * (tMax - 25))', motivo: 'Falta la temperatura máxima de diseño de la zona (dato nuevo de Fase B).' };
  }
  const vmpCaliente = panel.vmpStc * (1 + (panel.coefTempVmp / 100) * (temperaturaMaxima - 25));
  return { status: STATUS.PASS, calculated: round2_(vmpCaliente), formula: 'Vmp(T) = Vmp_STC * (1 + coefTempVmp/100 * (tMax - 25))', motivo: null };
}

// ── PARTE 5: verificaciones por candidato (cada una, función independiente) ─

/** CASE-B01. */
function verificarVocFrioString_(panel, inversor, temperaturaMinima, panelesPorString) {
  const c = calcularVocFrio_(panel, temperaturaMinima);
  if (c.status !== STATUS.PASS) return { check: 'STRING_VOC_COLD', status: c.status, calculated: null, limit: inversor.voltajeMaxEntradaDC, formula: c.formula, source: 'NEC 690.7 — corrección de Voc por temperatura mínima', motivo: c.motivo };
  if (inversor.voltajeMaxEntradaDC === undefined || inversor.voltajeMaxEntradaDC === null) {
    return { check: 'STRING_VOC_COLD', status: STATUS.UNKNOWN, calculated: round2_(c.calculated * panelesPorString), limit: null, formula: 'Voc_string_frio = Voc(T) * panelesPorString <= tensionDCMax', source: 'NEC 690.7', motivo: 'El inversor no tiene voltajeMaxEntradaDC en el catálogo.' };
  }
  const vocString = round2_(c.calculated * panelesPorString);
  const cumple = vocString <= inversor.voltajeMaxEntradaDC;
  return { check: 'STRING_VOC_COLD', status: cumple ? STATUS.PASS : STATUS.FAIL, calculated: vocString, limit: inversor.voltajeMaxEntradaDC, formula: 'Voc_string_frio = Voc(T) * panelesPorString <= tensionDCMax', source: 'NEC 690.7 — corrección de Voc por temperatura mínima', motivo: cumple ? null : 'Voc en frío del string excede la tensión máxima DC del inversor.' };
}

/** CASE-B02. */
function verificarVmpCalienteString_(panel, temperaturaMaxima, panelesPorString) {
  const c = calcularVmpCaliente_(panel, temperaturaMaxima);
  if (c.status !== STATUS.PASS) return { check: 'STRING_VMP_HOT', status: c.status, calculated: null, formula: c.formula, source: 'LEGACY_UNDOCUMENTED — no hay norma citada en el proyecto para el modelo térmico de Vmp', motivo: c.motivo };
  return { check: 'STRING_VMP_HOT', status: STATUS.PASS, calculated: round2_(c.calculated * panelesPorString), formula: 'Vmp_string_caliente = Vmp(T) * panelesPorString', source: 'LEGACY_UNDOCUMENTED', motivo: null };
}

/** Ventana MPPT — límite inferior. Depende de STRING_VMP_HOT; si es UNKNOWN, usa Vmp_STC como referencia y marca REQUIRES_REVIEW (nunca PASS silencioso). */
function verificarVentanaMpptMin_(panel, inversor, temperaturaMaxima, panelesPorString) {
  if (inversor.mpptMinV === undefined || inversor.mpptMinV === null) {
    return { check: 'MPPT_VOLTAGE_MIN', status: STATUS.UNKNOWN, calculated: null, limit: null, formula: 'Vmp_string >= mpptMinV', source: 'LEGACY_UNDOCUMENTED', motivo: 'El inversor no tiene mpptMinV en el catálogo.' };
  }
  const vmpHot = verificarVmpCalienteString_(panel, temperaturaMaxima, panelesPorString);
  if (vmpHot.status === STATUS.PASS) {
    const cumple = vmpHot.calculated >= inversor.mpptMinV;
    return { check: 'MPPT_VOLTAGE_MIN', status: cumple ? STATUS.PASS : STATUS.FAIL, calculated: vmpHot.calculated, limit: inversor.mpptMinV, formula: 'Vmp_string_caliente >= mpptMinV', source: 'LEGACY_UNDOCUMENTED', motivo: cumple ? null : 'La tensión del string en caliente cae por debajo de la ventana MPPT.' };
  }
  const vmpStcAprox = round2_(panel.vmpStc * panelesPorString);
  return { check: 'MPPT_VOLTAGE_MIN', status: STATUS.REQUIRES_REVIEW, calculated: vmpStcAprox, limit: inversor.mpptMinV, formula: 'Vmp_STC_string >= mpptMinV (referencia STC, sin corrección por temperatura caliente — dato no disponible)', source: 'LEGACY_UNDOCUMENTED', motivo: 'Vmp en caliente no calculable (falta coefTempVmp o temperaturaMaxima) — evaluado con Vmp_STC como referencia, requiere revisión manual.' };
}

/** Ventana MPPT — límite superior. Usa Vmp_STC (igual que el legacy) porque el límite superior es más restrictivo en frío/STC, no en caliente. */
function verificarVentanaMpptMax_(panel, inversor, panelesPorString) {
  if (inversor.mpptMaxV === undefined || inversor.mpptMaxV === null) {
    return { check: 'MPPT_VOLTAGE_MAX', status: STATUS.UNKNOWN, calculated: null, limit: null, formula: 'Vmp_STC_string <= mpptMaxV', source: 'LEGACY_UNDOCUMENTED', motivo: 'El inversor no tiene mpptMaxV en el catálogo.' };
  }
  if (panel.vmpStc === undefined || panel.vmpStc === null) {
    return { check: 'MPPT_VOLTAGE_MAX', status: STATUS.UNKNOWN, calculated: null, limit: inversor.mpptMaxV, formula: 'Vmp_STC_string <= mpptMaxV', source: 'LEGACY_UNDOCUMENTED', motivo: 'Falta Vmp_STC en el panel.' };
  }
  const vmpStcString = round2_(panel.vmpStc * panelesPorString);
  const cumple = vmpStcString <= inversor.mpptMaxV;
  return { check: 'MPPT_VOLTAGE_MAX', status: cumple ? STATUS.PASS : STATUS.FAIL, calculated: vmpStcString, limit: inversor.mpptMaxV, formula: 'Vmp_STC_string <= mpptMaxV', source: 'LEGACY_UNDOCUMENTED', motivo: cumple ? null : 'La tensión del string excede el máximo de la ventana MPPT.' };
}

/** CASE-B03. Corriente de diseño = Isc * factor de seguridad (misma fórmula legacy, NEC 690.8/RETIE). */
function calcularCorrienteDiseno_(panel) {
  if (panel.iscStc === undefined || panel.iscStc === null) {
    return { status: STATUS.UNKNOWN, calculated: null, formula: 'corrienteDiseno = Isc_STC * FACTOR_SEGURIDAD_ISC', motivo: 'Falta Isc_STC en el panel.' };
  }
  return { status: STATUS.PASS, calculated: round2_(panel.iscStc * FACTOR_SEGURIDAD_ISC), formula: 'corrienteDiseno = Isc_STC * FACTOR_SEGURIDAD_ISC (NEC 690.8 / RETIE)', motivo: null };
}

/** CASE-B03: corriente de ENTRADA (rated) por MPPT — distinta de la de cortocircuito (CASE-B04). */
function verificarCorrienteEntradaMppt_(panel, inversor, stringsPorMppt) {
  const cd = calcularCorrienteDiseno_(panel);
  if (cd.status !== STATUS.PASS) return { check: 'MPPT_INPUT_CURRENT', status: cd.status, calculated: null, formula: cd.formula, source: 'NEC 690.8 / RETIE', motivo: cd.motivo };
  if (inversor.corrienteMaxEntradaMPPT === undefined || inversor.corrienteMaxEntradaMPPT === null) {
    return { check: 'MPPT_INPUT_CURRENT', status: STATUS.UNKNOWN, calculated: null, limit: null, formula: 'corrienteTotalMPPT = corrienteDiseno * stringsPorMppt <= corrienteMaxEntradaMPPT', source: 'NEC 690.8 / RETIE', motivo: 'El inversor no tiene corrienteMaxEntradaMPPT en el catálogo.' };
  }
  const corrienteTotal = round2_(cd.calculated * stringsPorMppt);
  const cumple = corrienteTotal <= inversor.corrienteMaxEntradaMPPT;
  return { check: 'MPPT_INPUT_CURRENT', status: cumple ? STATUS.PASS : STATUS.FAIL, calculated: corrienteTotal, limit: inversor.corrienteMaxEntradaMPPT, formula: 'corrienteTotalMPPT = corrienteDiseno * stringsPorMppt <= corrienteMaxEntradaMPPT', source: 'NEC 690.8 / RETIE — factor de seguridad 1.25x sobre Isc', motivo: cumple ? null : 'La corriente de entrada al MPPT excede el límite (rated) del inversor.' };
}

/** CASE-B04: corriente de CORTOCIRCUITO ADMISIBLE por MPPT — campo NUEVO, distinto del anterior. */
function verificarCorrienteCortocircuitoMppt_(panel, inversor, stringsPorMppt) {
  if (inversor.corrienteMaxCortocircuitoMPPT === undefined || inversor.corrienteMaxCortocircuitoMPPT === null) {
    return { check: 'MPPT_SHORT_CIRCUIT_CURRENT', status: STATUS.UNKNOWN, calculated: null, limit: null, formula: 'IscTotalMPPT = Isc_STC * stringsPorMppt <= corrienteMaxCortocircuitoMPPT', source: 'LEGACY_UNDOCUMENTED — dato nuevo de Fase B, sin registros en catálogo real todavía', motivo: 'El inversor no tiene corrienteMaxCortocircuitoMPPT en el catálogo.' };
  }
  if (panel.iscStc === undefined || panel.iscStc === null) {
    return { check: 'MPPT_SHORT_CIRCUIT_CURRENT', status: STATUS.UNKNOWN, calculated: null, limit: inversor.corrienteMaxCortocircuitoMPPT, formula: 'IscTotalMPPT = Isc_STC * stringsPorMppt <= corrienteMaxCortocircuitoMPPT', source: 'LEGACY_UNDOCUMENTED', motivo: 'Falta Isc_STC en el panel.' };
  }
  const iscTotal = round2_(panel.iscStc * stringsPorMppt);
  const cumple = iscTotal <= inversor.corrienteMaxCortocircuitoMPPT;
  return { check: 'MPPT_SHORT_CIRCUIT_CURRENT', status: cumple ? STATUS.PASS : STATUS.FAIL, calculated: iscTotal, limit: inversor.corrienteMaxCortocircuitoMPPT, formula: 'IscTotalMPPT = Isc_STC * stringsPorMppt <= corrienteMaxCortocircuitoMPPT', source: 'LEGACY_UNDOCUMENTED', motivo: cumple ? null : 'La corriente de cortocircuito del MPPT excede lo admisible por el inversor.' };
}

/** Potencia DC vs. potencia AC máxima (DC/AC ratio). */
function verificarPotenciaDC_(numPaneles, panel, inversor) {
  const pDC = round0_(numPaneles * panel.potenciaW);
  if (inversor.potenciaACMax === undefined || inversor.potenciaACMax === null) {
    return { check: 'DC_POWER', status: STATUS.REQUIRES_REVIEW, calculated: pDC, limit: null, formula: 'Pdc = numPaneles * potenciaW_panel', source: 'LEGACY_UNDOCUMENTED', motivo: 'El inversor no tiene potenciaACMax en el catálogo; no se puede verificar el ratio DC/AC real.' };
  }
  const cumple = pDC <= inversor.potenciaACMax * 1.3;
  return { check: 'DC_POWER', status: cumple ? STATUS.PASS : STATUS.FAIL, calculated: pDC, limit: inversor.potenciaACMax, formula: 'Pdc <= potenciaACMax * 1.3 (DC/AC ratio típico)', source: 'LEGACY_UNDOCUMENTED', motivo: cumple ? null : 'La potencia DC excede el máximo admisible del inversor (ratio DC/AC > 1.3).' };
}

/** AC_POWER: chequeo heurístico legacy (±30% de potenciaW nominal) — mismo que ya usa calcularSistema, reexpuesto como AuditEntry. */
function verificarPotenciaAC_(potenciaSistemaW, inversor) {
  const dentroDeRango = inversor.potenciaW >= potenciaSistemaW * 0.7 && inversor.potenciaW <= potenciaSistemaW * 1.3;
  return { check: 'AC_POWER', status: dentroDeRango ? STATUS.PASS : STATUS.FAIL, calculated: inversor.potenciaW, limit: [round0_(potenciaSistemaW * 0.7), round0_(potenciaSistemaW * 1.3)], formula: 'potenciaW_inversor dentro de ±30% de la potencia ajustada del sistema', source: 'LEGACY_UNDOCUMENTED', motivo: dentroDeRango ? null : 'La potencia nominal del inversor está fuera del ±30% de la potencia del sistema.' };
}

/** CASE-B05/B06: configuración total de strings vs. máximo admisible del inversor. */
function verificarConfiguracionStrings_(inversor, numeroStrings) {
  if (inversor.numeroMaxStrings === undefined || inversor.numeroMaxStrings === null) {
    return { check: 'STRING_CONFIGURATION', status: STATUS.UNKNOWN, calculated: numeroStrings, limit: null, formula: 'numeroStrings <= numeroMaxStrings', source: 'LEGACY_UNDOCUMENTED', motivo: 'El inversor no tiene numeroMaxStrings en el catálogo.' };
  }
  const cumple = numeroStrings <= inversor.numeroMaxStrings;
  return { check: 'STRING_CONFIGURATION', status: cumple ? STATUS.PASS : STATUS.FAIL, calculated: numeroStrings, limit: inversor.numeroMaxStrings, formula: 'numeroStrings <= numeroMaxStrings', source: 'LEGACY_UNDOCUMENTED', motivo: cumple ? null : 'Se necesitan más strings de los que el inversor admite en total.' };
}

/** CASE-B06: distribución de strings entre MPPT. Sin política de equilibrio definida más allá de "reparto exacto" → REQUIRES_REVIEW si no es exacto, nunca PASS por defecto. */
function verificarDistribucionMppt_(inversor, numeroStrings, stringsPorMppt) {
  const numMppt = inversor.numeroMppt || 1;
  const balanceado = numeroStrings % numMppt === 0;
  if (balanceado) {
    return { check: 'MPPT_DISTRIBUTION', status: STATUS.PASS, calculated: stringsPorMppt, formula: 'numeroStrings % numeroMPPT === 0 (distribución equilibrada)', source: 'LEGACY_UNDOCUMENTED — no hay política de desbalance definida en el proyecto', motivo: null };
  }
  return { check: 'MPPT_DISTRIBUTION', status: STATUS.REQUIRES_REVIEW, calculated: stringsPorMppt, formula: 'numeroStrings % numeroMPPT === 0 (distribución equilibrada)', source: 'LEGACY_UNDOCUMENTED', motivo: 'Los strings no se reparten en partes iguales entre los MPPT disponibles — requiere definir manualmente la distribución.' };
}

// ── PARTE 4: enumerador de configuraciones candidatas de string ────────────

/**
 * Sustituye `nSerie = Math.min(nSerieMax, numPanelesTotal)` (legacy, Code.gs `verificarString_`)
 * por una ENUMERACIÓN de todas las configuraciones válidas de paneles-por-string dentro de la
 * ventana de voltaje/MPPT (acotada por Voc-frío y Vmp-STC, igual que el legacy), cada una
 * validada independientemente con las funciones de arriba — no solo la de mayor tamaño.
 */
function enumerarCandidatosString_(panel, inversor, temperaturaMinima, temperaturaMaxima, numPanelesTotal) {
  const candidatos = [];

  if (panel.vocStc === undefined || !inversor.voltajeMaxEntradaDC ||
      panel.vmpStc === undefined || inversor.mpptMinV === undefined || inversor.mpptMaxV === undefined) {
    return candidatos; // sin datos mínimos ni siquiera se puede acotar el rango — lista vacía, no candidatos inventados
  }

  const vocFrio = calcularVocFrio_(panel, temperaturaMinima);
  const vocFrioV = vocFrio.status === STATUS.PASS ? vocFrio.calculated : panel.vocStc; // fallback STC si no hay tMin (auditado aparte como UNKNOWN)

  const maxSeriePorVoltaje = Math.floor(inversor.voltajeMaxEntradaDC / vocFrioV);
  const minSeriePorMppt = Math.ceil(inversor.mpptMinV / panel.vmpStc);
  const maxSeriePorMppt = Math.floor(inversor.mpptMaxV / panel.vmpStc);
  const nSerieMax = Math.min(maxSeriePorVoltaje, maxSeriePorMppt, numPanelesTotal);

  for (let panelesPorString = minSeriePorMppt; panelesPorString <= nSerieMax; panelesPorString++) {
    if (panelesPorString < 1) continue;
    const numeroStrings = Math.ceil(numPanelesTotal / panelesPorString);
    const numMppt = inversor.numeroMppt || 1;
    const stringsPorMppt = Math.ceil(numeroStrings / numMppt);

    const checks = {
      STRING_VOC_COLD: verificarVocFrioString_(panel, inversor, temperaturaMinima, panelesPorString),
      STRING_VMP_HOT: verificarVmpCalienteString_(panel, temperaturaMaxima, panelesPorString),
      MPPT_VOLTAGE_MIN: verificarVentanaMpptMin_(panel, inversor, temperaturaMaxima, panelesPorString),
      MPPT_VOLTAGE_MAX: verificarVentanaMpptMax_(panel, inversor, panelesPorString),
      MPPT_INPUT_CURRENT: verificarCorrienteEntradaMppt_(panel, inversor, stringsPorMppt),
      MPPT_SHORT_CIRCUIT_CURRENT: verificarCorrienteCortocircuitoMppt_(panel, inversor, stringsPorMppt),
      STRING_CONFIGURATION: verificarConfiguracionStrings_(inversor, numeroStrings),
      MPPT_DISTRIBUTION: verificarDistribucionMppt_(inversor, numeroStrings, stringsPorMppt)
    };

    const estados = Object.keys(checks).map(function (k) { return checks[k].status; });
    let estadoGeneral;
    if (estados.indexOf(STATUS.FAIL) !== -1) estadoGeneral = STATUS.FAIL;
    else if (estados.indexOf(STATUS.REQUIRES_REVIEW) !== -1) estadoGeneral = STATUS.REQUIRES_REVIEW;
    else if (estados.indexOf(STATUS.UNKNOWN) !== -1) estadoGeneral = STATUS.REQUIRES_REVIEW; // desconocido implica revisión, no PASS silencioso
    else estadoGeneral = STATUS.PASS;

    candidatos.push({ panelesPorString: panelesPorString, numeroStrings: numeroStrings, stringsPorMppt: stringsPorMppt, checks: checks, status: estadoGeneral });
  }

  return candidatos;
}

// ── Selección de candidatos (AUTORIZACIÓN CONDICIONADA — FASE B) ───────────

/**
 * Semántica de selección EXACTA autorizada (no negociable sin nueva autorización):
 * - FAIL: excluye el candidato por completo, nunca seleccionable.
 * - PASS: seleccionable y preferido sobre cualquier REQUIRES_REVIEW disponible — nunca se
 *   elige un REQUIRES_REVIEW en vez de un PASS comparable por razones comerciales (precio).
 * - REQUIRES_REVIEW: seleccionable SOLO si no hay ningún PASS para este panel+inversor; el
 *   candidato nunca se presenta como validado (ver `resultado.estadoConfiguracion` en Code.gs).
 * - UNKNOWN en cualquier chequeo ya se resolvió como REQUIRES_REVIEW dentro de
 *   `enumerarCandidatosString_` (nunca PASS silencioso) — esta función no vuelve a tocar eso.
 *
 * Dentro del mismo nivel de estado (todos PASS, o todos REQUIRES_REVIEW porque no hay PASS),
 * se prefiere el candidato con MÁS paneles por string — mismo criterio económico que el legacy
 * `nSerie = Math.min(nSerieMax, numPanelesTotal)` (menos strings en paralelo, BOM más barato).
 * Esto es una elección de configuración física entre candidatos igualmente válidos/revisables,
 * no una degradación del estado de cumplimiento — el estado del candidato elegido se conserva
 * y se expone tal cual en el resultado.
 */
function elegirMejorCandidato_(candidatos) {
  const seleccionables = candidatos.filter(function (c) { return c.status !== STATUS.FAIL; });
  if (seleccionables.length === 0) return null;

  const enPass = seleccionables.filter(function (c) { return c.status === STATUS.PASS; });
  const pool = enPass.length > 0 ? enPass : seleccionables;

  return pool.reduce(function (mejor, actual) {
    return actual.panelesPorString > mejor.panelesPorString ? actual : mejor;
  });
}
