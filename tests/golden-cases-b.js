// Fase B — Golden Cases B01-B08 (ENGINEERING.md, PARTE 8).
// Cada caso llama DIRECTO a las funciones nuevas de ElectricalEngine.gs (las mismas que usará
// `enumerarCandidatosString_`, no una copia) con fixtures sintéticos diseñados a propósito para
// disparar cada situación — no son datos de un cliente real, son unitarios por diseño (a
// diferencia de los Golden Cases A, que sí usan catálogos con forma de catálogo real).
// `expectedOutput` es una captura real de cada función corriendo, no un valor a mano.
'use strict';

module.exports = [
  {
    name: 'CASE-B01',
    notes: 'Voc frío demasiado alto — clima muy frío (-10°C) empuja Voc por encima de la tensión máxima DC del inversor.',
    run: function (sb) {
      return sb.verificarVocFrioString_({ vocStc: 50, coefTempVoc: -0.3, vmpStc: 41 }, { voltajeMaxEntradaDC: 500 }, -10, 11);
    },
    expectedOutput: {
      check: 'STRING_VOC_COLD', status: 'FAIL', calculated: 607.75, limit: 500,
      formula: 'Voc_string_frio = Voc(T) * panelesPorString <= tensionDCMax',
      source: 'NEC 690.7 — corrección de Voc por temperatura mínima',
      motivo: 'Voc en frío del string excede la tensión máxima DC del inversor.'
    }
  },
  {
    name: 'CASE-B02',
    notes: 'Vmp caliente demasiado bajo — clima muy caluroso (45°C) hace caer Vmp por debajo del mínimo MPPT. Requiere coefTempVmp poblado (dato nuevo de Fase B).',
    run: function (sb) {
      return sb.verificarVentanaMpptMin_({ vmpStc: 41, coefTempVmp: -0.4 }, { mpptMinV: 100 }, 45, 2);
    },
    expectedOutput: {
      check: 'MPPT_VOLTAGE_MIN', status: 'FAIL', calculated: 75.44, limit: 100,
      formula: 'Vmp_string_caliente >= mpptMinV', source: 'LEGACY_UNDOCUMENTED',
      motivo: 'La tensión del string en caliente cae por debajo de la ventana MPPT.'
    }
  },
  {
    name: 'CASE-B03',
    notes: 'Corriente de entrada MPPT (rated) excedida.',
    run: function (sb) {
      return sb.verificarCorrienteEntradaMppt_({ iscStc: 15 }, { corrienteMaxEntradaMPPT: 16 }, 1);
    },
    expectedOutput: {
      check: 'MPPT_INPUT_CURRENT', status: 'FAIL', calculated: 18.75, limit: 16,
      formula: 'corrienteTotalMPPT = corrienteDiseno * stringsPorMppt <= corrienteMaxEntradaMPPT',
      source: 'NEC 690.8 / RETIE — factor de seguridad 1.25x sobre Isc',
      motivo: 'La corriente de entrada al MPPT excede el límite (rated) del inversor.'
    }
  },
  {
    name: 'CASE-B04',
    notes: 'Corriente de entrada (rated) y corriente de cortocircuito admisible son restricciones DISTINTAS — misma configuración, un panel/inversor donde la primera PASA y la segunda FALLA, probando que no son el mismo campo.',
    run: function (sb) {
      const panel = { iscStc: 8 };
      const inversor = { corrienteMaxEntradaMPPT: 25, corrienteMaxCortocircuitoMPPT: 15 };
      return {
        entrada: sb.verificarCorrienteEntradaMppt_(panel, inversor, 2),
        cortocircuito: sb.verificarCorrienteCortocircuitoMppt_(panel, inversor, 2)
      };
    },
    expectedOutput: {
      entrada: { check: 'MPPT_INPUT_CURRENT', status: 'PASS', calculated: 20, limit: 25, formula: 'corrienteTotalMPPT = corrienteDiseno * stringsPorMppt <= corrienteMaxEntradaMPPT', source: 'NEC 690.8 / RETIE — factor de seguridad 1.25x sobre Isc', motivo: null },
      cortocircuito: { check: 'MPPT_SHORT_CIRCUIT_CURRENT', status: 'FAIL', calculated: 16, limit: 15, formula: 'IscTotalMPPT = Isc_STC * stringsPorMppt <= corrienteMaxCortocircuitoMPPT', source: 'LEGACY_UNDOCUMENTED', motivo: 'La corriente de cortocircuito del MPPT excede lo admisible por el inversor.' }
    }
  },
  {
    name: 'CASE-B05',
    notes: 'El enumerador produce VARIOS candidatos (no solo nSerieMax) para el mismo panel/inversor real (Jinko P1 + Growatt I1, 7 paneles, Barranquilla) — demuestra que ya no se usa nSerie=máximo posible.',
    run: function (sb) {
      const catalogo = sb.leerCatalogo_();
      const panel = catalogo.find(function (c) { return c.id === 'P1'; });
      const inversor = catalogo.find(function (c) { return c.id === 'I1'; });
      const candidatos = sb.enumerarCandidatosString_(panel, inversor, 22, undefined, 7);
      return candidatos.map(function (c) { return { panelesPorString: c.panelesPorString, numeroStrings: c.numeroStrings, status: c.status }; });
    },
    expectedOutput: [
      { panelesPorString: 2, numeroStrings: 4, status: 'FAIL' },
      { panelesPorString: 3, numeroStrings: 3, status: 'FAIL' },
      { panelesPorString: 4, numeroStrings: 2, status: 'REQUIRES_REVIEW' },
      { panelesPorString: 5, numeroStrings: 2, status: 'REQUIRES_REVIEW' },
      { panelesPorString: 6, numeroStrings: 2, status: 'REQUIRES_REVIEW' },
      { panelesPorString: 7, numeroStrings: 1, status: 'REQUIRES_REVIEW' }
    ],
    notaAdicional: 'Los REQUIRES_REVIEW (no PASS) se explican en docs/PHASE_B_INVENTORY.md: STRING_VMP_HOT es UNKNOWN porque el catálogo real no tiene coefTempVmp todavía — ver decisión pendiente antes de conectar esto a calcularSistema.'
  },
  {
    name: 'CASE-B06',
    notes: 'Strings desbalanceados entre MPPT (5 strings en 2 MPPT no reparte exacto) — política del proyecto: REQUIRES_REVIEW, nunca PASS automático.',
    run: function (sb) {
      return sb.verificarDistribucionMppt_({ numeroMppt: 2 }, 5, 3);
    },
    expectedOutput: {
      check: 'MPPT_DISTRIBUTION', status: 'REQUIRES_REVIEW', calculated: 3,
      formula: 'numeroStrings % numeroMPPT === 0 (distribución equilibrada)', source: 'LEGACY_UNDOCUMENTED',
      motivo: 'Los strings no se reparten en partes iguales entre los MPPT disponibles — requiere definir manualmente la distribución.'
    }
  },
  {
    name: 'CASE-B07',
    notes: 'Inversor sin tensionArranque (dato nuevo de Fase B, ninguna fila real lo tiene) — leerCatalogo_ debe devolver `undefined`, nunca inventar 0 ni copiar otro campo.',
    run: function (sb) {
      const catalogo = sb.leerCatalogo_();
      const inversor = catalogo.find(function (c) { return c.id === 'I1'; });
      return inversor.tensionArranque;
    },
    expectedOutput: undefined
  },
  {
    name: 'CASE-B08',
    notes: 'Configuración válida de referencia con TODOS los datos nuevos poblados (fixture sintético completo) — demuestra que el motor SÍ produce PASS limpio cuando no falta ningún dato.',
    run: function (sb) {
      const panel = { vocStc: 50, vmpStc: 40, iscStc: 10, coefTempVoc: -0.3, coefTempVmp: -0.35, potenciaW: 400 };
      const inversor = { voltajeMaxEntradaDC: 500, mpptMinV: 100, mpptMaxV: 450, corrienteMaxEntradaMPPT: 20, corrienteMaxCortocircuitoMPPT: 20, numeroMppt: 2, numeroMaxStrings: 4, potenciaACMax: 5000, potenciaW: 5000 };
      const candidatos = sb.enumerarCandidatosString_(panel, inversor, 10, 35, 16);
      const elegido = candidatos.find(function (c) { return c.panelesPorString === 8; });
      return {
        totalCandidatos: candidatos.length,
        candidato8: { panelesPorString: elegido.panelesPorString, numeroStrings: elegido.numeroStrings, status: elegido.status },
        dcPower: sb.verificarPotenciaDC_(16, panel, inversor),
        acPower: sb.verificarPotenciaAC_(6400, inversor)
      };
    },
    expectedOutput: {
      totalCandidatos: 7,
      candidato8: { panelesPorString: 8, numeroStrings: 2, status: 'PASS' },
      dcPower: { check: 'DC_POWER', status: 'PASS', calculated: 6400, limit: 5000, formula: 'Pdc <= potenciaACMax * 1.3 (DC/AC ratio típico)', source: 'LEGACY_UNDOCUMENTED', motivo: null },
      acPower: { check: 'AC_POWER', status: 'PASS', calculated: 5000, limit: [4480, 8320], formula: 'potenciaW_inversor dentro de ±30% de la potencia ajustada del sistema', source: 'LEGACY_UNDOCUMENTED', motivo: null }
    }
  }
];
