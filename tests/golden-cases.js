// Fase A — Paso 7: Golden Cases.
// Cada `expectedLegacyOutput` es una CAPTURA real de `legacyCalculationEngine()` (alias de
// `calcularSistema()`, sin cambios) corriendo contra los fixtures congelados de tests/fixtures/
// y tests/fixtures-incompatible/ — no son valores calculados a mano. Ver docs/PHASE_A_INVENTORY.md
// y GAP-ANALYSIS.md para el porqué de cada caso.
'use strict';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', WARNING: 'WARNING', REQUIRES_REVIEW: 'REQUIRES_REVIEW', NOT_APPLICABLE: 'NOT_APPLICABLE', UNKNOWN: 'UNKNOWN' };

module.exports = [
  {
    name: 'CASE-001',
    engine: 'incompatible',
    input: { consumoMensualKWh: 450, ciudad: 'Barranquilla' },
    expectedStatus: STATUS.FAIL,
    notes: 'Panel/inversor incompatible — reproduce el hallazgo real de la cotización Energitel SAS (2026-09-25): el panel ZNShine 650Wp (Isc 16.34A) excede la corriente máxima por MPPT de los 5 inversores Livoltek cotizados (14-16A). Catálogo de este caso: SOLO los equipos Energitel (tests/fixtures-incompatible/), para que no se cuele ningún panel/inversor compatible del catálogo demo.',
    expectedLegacyOutput: {
      fueraDeAlcanceAGPE: false,
      potenciaAjustadaKwp: 3.26,
      numPanelesEstimado: null,
      error: 'Ningún inversor del catálogo es compatible con el string resultante para esta potencia. Revisa el catálogo o ajusta manualmente.'
    }
  },
  {
    name: 'CASE-002',
    engine: 'mixto',
    input: { consumoMensualKWh: 350, ciudad: 'Barranquilla' },
    expectedStatus: STATUS.PASS,
    notes: 'Configuración compatible — método por consumo mensual (sección 4.1). Caso de referencia probado en vivo durante la sesión de construcción original (2.54 kWp, 7 paneles Jinko + Growatt MIN 3000TL-X).',
    expectedLegacyOutput: {
      fueraDeAlcanceAGPE: false, metodoUsado: 'consumo',
      zona: { ciudad: 'Barranquilla', hspPromedio: 5.75, temperaturaMinima: 22, tarifaEnergiaCOP: 950 },
      demandaMaximaKW: null, consumoMensualKWh: 350, consumoDiarioKWh: 11.67,
      potenciaBrutaKwp: 2.03, potenciaAjustadaKwp: 2.54,
      panel: { id: 'P1', tipo: 'Panel', marca: 'Jinko Solar', modelo: 'JKM415M-54HL4-V', proveedor: 'Distribuidor Demo', potenciaW: 415, vocStc: 49.5, vmpStc: 41.4, iscStc: 10.34, coefTempVoc: -0.26, voltajeMaxEntradaDC: 0, mpptMinV: 0, mpptMaxV: 0, corrienteMaxPorMppt: 0, numeroMppt: 1, capacidadKWh: 0, corrienteA: 0, precio: 480000, fichaTecnicaURL: '', activo: true },
      inversor: { id: 'I1', tipo: 'Inversor', marca: 'Growatt', modelo: 'MIN 3000TL-X', proveedor: 'Distribuidor Demo', potenciaW: 3000, vocStc: 0, vmpStc: 0, iscStc: 0, coefTempVoc: 0, voltajeMaxEntradaDC: 500, mpptMinV: 80, mpptMaxV: 450, corrienteMaxPorMppt: 13.5, numeroMppt: 2, capacidadKWh: 0, corrienteA: 0, precio: 2100000, fichaTecnicaURL: '', activo: true },
      numPaneles: 7,
      verificacionString: { compatible: true, motivo: null, vocCorregidoV: 49.89, panelesPorString: 7, numeroStrings: 1, stringsPorMppt: 1, maxStringsPorMppt: 1, fusibleRecomendadoA: 12.93 },
      bom: {
        items: [
          { categoria: 'Estructura de montaje', marca: 'Genérica', modelo: 'Riel aluminio + ganchos (techo teja)', cantidad: 7, unidad: 'unidad', precioUnitario: 90000, subtotal: 630000, fichaTecnicaURL: '' },
          { categoria: 'Cableado DC', marca: 'Genérico', modelo: 'Cable solar 12AWG (4mm²)', cantidad: 29, unidad: 'metro', precioUnitario: 2600, subtotal: 75400, fichaTecnicaURL: '' },
          { categoria: 'Cableado AC', marca: 'Genérico', modelo: 'Cable THHN 10AWG', cantidad: 20, unidad: 'metro', precioUnitario: 4200, subtotal: 84000, fichaTecnicaURL: '' },
          { categoria: 'Protección DC por string', marca: 'Genérico', modelo: 'Breaker DC 15A', cantidad: 1, unidad: 'unidad', precioUnitario: 48000, subtotal: 48000, fichaTecnicaURL: '' },
          { categoria: 'Protección AC general', marca: 'Genérico', modelo: 'Breaker AC 20A', cantidad: 1, unidad: 'unidad', precioUnitario: 62000, subtotal: 62000, fichaTecnicaURL: '' },
          { categoria: 'Protección contra sobretensiones (DPS)', marca: 'Genérico', modelo: 'DPS Clase II 40kA', cantidad: 1, unidad: 'unidad', precioUnitario: 185000, subtotal: 185000, fichaTecnicaURL: '' },
          { categoria: 'Conectores MC4', marca: 'Staubli', modelo: 'MC4 (par)', cantidad: 8, unidad: 'par', precioUnitario: 8500, subtotal: 68000, fichaTecnicaURL: '' },
          { categoria: 'Puesta a tierra', marca: 'Genérico', modelo: 'Kit puesta a tierra', cantidad: 1, unidad: 'kit', precioUnitario: 160000, subtotal: 160000, fichaTecnicaURL: '' },
          { categoria: 'Medidor bidireccional', marca: 'Genérico', modelo: 'Medidor bidireccional monofásico', cantidad: 1, unidad: 'unidad', precioUnitario: 360000, subtotal: 360000, fichaTecnicaURL: '' }
        ],
        advertencias: [], subtotalPanelesInversor: 5460000, subtotalMateriales: 1672400, totalMateriales: 7132400
      },
      financiero: { subtotalMateriales: 7132400, inversionEstimada: 8202260, ahorroMensual: 332500, ahorroAnual: 3990000, paybackMeses: 24.7, paybackAnos: 2.1, retorno25Anos: 91547740 },
      regulatorio: { dentroDeAGPE: true, limiteAGPEKwp: 1000, referenciaResolucion: 'Resolución CREG 174 de 2021 — Autogeneración a Pequeña Escala (AGPE), conectada al Sistema de Distribución Local.', notaRETIE: 'La instalación debe cumplir el Reglamento Técnico de Instalaciones Eléctricas (RETIE) vigente.', notaLey1715: 'Proyecto acogido a los beneficios de la Ley 1715 de 2014 para fuentes no convencionales de energía (sujeto a verificación tributaria del cliente).' },
      opcionesCompatibles: 2,
      diagramaSVG: '<svg viewBox="0 0 1190 100" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Roboto, sans-serif"><rect x="0" y="0" width="1190" height="100" fill="#0a0a0a"/><rect x="20" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="85" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">7 panel(es) en serie</text><line x1="150" y1="50" x2="182" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="182,45 190,50 182,55" fill="#00e5ff"/><rect x="190" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="255" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Protección DC</text><text x="255" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">12.93 A</text><line x1="320" y1="50" x2="352" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="352,45 360,50 352,55" fill="#00e5ff"/><rect x="360" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="425" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Inversor</text><text x="425" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">Growatt MIN 3000TL-X</text><line x1="490" y1="50" x2="522" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="522,45 530,50 522,55" fill="#00e5ff"/><rect x="530" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="595" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Protección AC</text><text x="595" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">13.6 A</text><line x1="660" y1="50" x2="692" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="692,45 700,50 692,55" fill="#00e5ff"/><rect x="700" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="765" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">DPS</text><line x1="830" y1="50" x2="862" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="862,45 870,50 862,55" fill="#00e5ff"/><rect x="870" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="935" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Medidor</text><text x="935" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">bidireccional</text><line x1="1000" y1="50" x2="1032" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="1032,45 1040,50 1032,55" fill="#00e5ff"/><rect x="1040" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="1105" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">Red eléctrica</text></svg>'
    }
  },
  {
    name: 'CASE-003',
    engine: 'mixto',
    input: { demandaMaximaKW: 6, ciudad: 'Barranquilla' },
    expectedStatus: STATUS.PASS,
    notes: 'Demanda máxima del recibo (cargabilidad, sección 4.2) — método que ENGINEERING.md prohíbe como sustituto del dimensionamiento energético (ver GAP-ANALYSIS.md, decisión pendiente #1). Se congela igual: este caso NO decide si el método está bien, solo documenta qué hace HOY.',
    expectedLegacyOutput: {
      fueraDeAlcanceAGPE: false, metodoUsado: 'cargabilidad',
      zona: { ciudad: 'Barranquilla', hspPromedio: 5.75, temperaturaMinima: 22, tarifaEnergiaCOP: 950 },
      demandaMaximaKW: 6, consumoMensualKWh: null, consumoDiarioKWh: null,
      potenciaBrutaKwp: 6, potenciaAjustadaKwp: 7.5,
      panel: { id: 'P1', tipo: 'Panel', marca: 'Jinko Solar', modelo: 'JKM415M-54HL4-V', proveedor: 'Distribuidor Demo', potenciaW: 415, vocStc: 49.5, vmpStc: 41.4, iscStc: 10.34, coefTempVoc: -0.26, voltajeMaxEntradaDC: 0, mpptMinV: 0, mpptMaxV: 0, corrienteMaxPorMppt: 0, numeroMppt: 1, capacidadKWh: 0, corrienteA: 0, precio: 480000, fichaTecnicaURL: '', activo: true },
      inversor: { id: 'EI1', tipo: 'Inversor', marca: 'Livoltek', modelo: 'GT1-6KD2', proveedor: 'Energitel SAS', potenciaW: 6000, vocStc: 0, vmpStc: 0, iscStc: 0, coefTempVoc: 0, voltajeMaxEntradaDC: 600, mpptMinV: 70, mpptMaxV: 550, corrienteMaxPorMppt: 16, numeroMppt: 2, capacidadKWh: 0, corrienteA: 0, precio: 2153000, fichaTecnicaURL: '', activo: true },
      numPaneles: 19,
      verificacionString: { compatible: true, motivo: null, vocCorregidoV: 49.89, panelesPorString: 12, numeroStrings: 2, stringsPorMppt: 1, maxStringsPorMppt: 1, fusibleRecomendadoA: 12.93 },
      bom: {
        items: [
          { categoria: 'Estructura de montaje', marca: 'Genérica', modelo: 'Riel aluminio + ganchos (techo teja)', cantidad: 19, unidad: 'unidad', precioUnitario: 90000, subtotal: 1710000, fichaTecnicaURL: '' },
          { categoria: 'Cableado DC', marca: 'Genérico', modelo: 'Cable solar 12AWG (4mm²)', cantidad: 53, unidad: 'metro', precioUnitario: 2600, subtotal: 137800, fichaTecnicaURL: '' },
          { categoria: 'Cableado AC', marca: 'Genérico', modelo: 'Cable THHN 10AWG', cantidad: 20, unidad: 'metro', precioUnitario: 4200, subtotal: 84000, fichaTecnicaURL: '' },
          { categoria: 'Protección DC por string', marca: 'Genérico', modelo: 'Breaker DC 15A', cantidad: 2, unidad: 'unidad', precioUnitario: 48000, subtotal: 96000, fichaTecnicaURL: '' },
          { categoria: 'Protección AC general', marca: 'Genérico', modelo: 'Breaker AC 32A', cantidad: 1, unidad: 'unidad', precioUnitario: 78000, subtotal: 78000, fichaTecnicaURL: '' },
          { categoria: 'Protección contra sobretensiones (DPS)', marca: 'Genérico', modelo: 'DPS Clase II 40kA', cantidad: 1, unidad: 'unidad', precioUnitario: 185000, subtotal: 185000, fichaTecnicaURL: '' },
          { categoria: 'Conectores MC4', marca: 'Staubli', modelo: 'MC4 (par)', cantidad: 21, unidad: 'par', precioUnitario: 8500, subtotal: 178500, fichaTecnicaURL: '' },
          { categoria: 'Puesta a tierra', marca: 'Genérico', modelo: 'Kit puesta a tierra', cantidad: 1, unidad: 'kit', precioUnitario: 160000, subtotal: 160000, fichaTecnicaURL: '' },
          { categoria: 'Medidor bidireccional', marca: 'Genérico', modelo: 'Medidor bidireccional monofásico', cantidad: 1, unidad: 'unidad', precioUnitario: 360000, subtotal: 360000, fichaTecnicaURL: '' }
        ],
        advertencias: [], subtotalPanelesInversor: 11273000, subtotalMateriales: 2989300, totalMateriales: 14262300
      },
      financiero: { subtotalMateriales: 14262300, inversionEstimada: 16401645, ahorroMensual: 1229063, ahorroAnual: 14748750, paybackMeses: 13.3, paybackAnos: 1.1, retorno25Anos: 352317105 },
      regulatorio: { dentroDeAGPE: true, limiteAGPEKwp: 1000, referenciaResolucion: 'Resolución CREG 174 de 2021 — Autogeneración a Pequeña Escala (AGPE), conectada al Sistema de Distribución Local.', notaRETIE: 'La instalación debe cumplir el Reglamento Técnico de Instalaciones Eléctricas (RETIE) vigente.', notaLey1715: 'Proyecto acogido a los beneficios de la Ley 1715 de 2014 para fuentes no convencionales de energía (sujeto a verificación tributaria del cliente).' },
      opcionesCompatibles: 2,
      diagramaSVG: '<svg viewBox="0 0 1190 100" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Roboto, sans-serif"><rect x="0" y="0" width="1190" height="100" fill="#0a0a0a"/><rect x="20" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="85" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">12 panel(es) en serie  ×2 strings</text><line x1="150" y1="50" x2="182" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="182,45 190,50 182,55" fill="#00e5ff"/><rect x="190" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="255" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Protección DC</text><text x="255" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">12.93 A</text><line x1="320" y1="50" x2="352" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="352,45 360,50 352,55" fill="#00e5ff"/><rect x="360" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="425" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Inversor</text><text x="425" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">Livoltek GT1-6KD2</text><line x1="490" y1="50" x2="522" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="522,45 530,50 522,55" fill="#00e5ff"/><rect x="530" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="595" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Protección AC</text><text x="595" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">27.3 A</text><line x1="660" y1="50" x2="692" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="692,45 700,50 692,55" fill="#00e5ff"/><rect x="700" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="765" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">DPS</text><line x1="830" y1="50" x2="862" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="862,45 870,50 862,55" fill="#00e5ff"/><rect x="870" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="935" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Medidor</text><text x="935" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">bidireccional</text><line x1="1000" y1="50" x2="1032" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="1032,45 1040,50 1032,55" fill="#00e5ff"/><rect x="1040" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="1105" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">Red eléctrica</text></svg>'
    }
  },
  {
    name: 'CASE-004',
    engine: 'mixto',
    input: { consumoMensualKWh: 900, ciudad: 'Barranquilla' },
    expectedStatus: STATUS.PASS,
    notes: 'Método energético por consumo (4.1) a mayor escala que CASE-002, para cubrir un tramo de potencia distinto (elige un inversor Livoltek en vez del Growatt más pequeño).',
    expectedLegacyOutput: {
      fueraDeAlcanceAGPE: false, metodoUsado: 'consumo',
      zona: { ciudad: 'Barranquilla', hspPromedio: 5.75, temperaturaMinima: 22, tarifaEnergiaCOP: 950 },
      demandaMaximaKW: null, consumoMensualKWh: 900, consumoDiarioKWh: 30,
      potenciaBrutaKwp: 5.22, potenciaAjustadaKwp: 6.52,
      panel: { id: 'P1', tipo: 'Panel', marca: 'Jinko Solar', modelo: 'JKM415M-54HL4-V', proveedor: 'Distribuidor Demo', potenciaW: 415, vocStc: 49.5, vmpStc: 41.4, iscStc: 10.34, coefTempVoc: -0.26, voltajeMaxEntradaDC: 0, mpptMinV: 0, mpptMaxV: 0, corrienteMaxPorMppt: 0, numeroMppt: 1, capacidadKWh: 0, corrienteA: 0, precio: 480000, fichaTecnicaURL: '', activo: true },
      inversor: { id: 'EI1', tipo: 'Inversor', marca: 'Livoltek', modelo: 'GT1-6KD2', proveedor: 'Energitel SAS', potenciaW: 6000, vocStc: 0, vmpStc: 0, iscStc: 0, coefTempVoc: 0, voltajeMaxEntradaDC: 600, mpptMinV: 70, mpptMaxV: 550, corrienteMaxPorMppt: 16, numeroMppt: 2, capacidadKWh: 0, corrienteA: 0, precio: 2153000, fichaTecnicaURL: '', activo: true },
      numPaneles: 16,
      verificacionString: { compatible: true, motivo: null, vocCorregidoV: 49.89, panelesPorString: 12, numeroStrings: 2, stringsPorMppt: 1, maxStringsPorMppt: 1, fusibleRecomendadoA: 12.93 },
      bom: {
        items: [
          { categoria: 'Estructura de montaje', marca: 'Genérica', modelo: 'Riel aluminio + ganchos (techo teja)', cantidad: 16, unidad: 'unidad', precioUnitario: 90000, subtotal: 1440000, fichaTecnicaURL: '' },
          { categoria: 'Cableado DC', marca: 'Genérico', modelo: 'Cable solar 12AWG (4mm²)', cantidad: 47, unidad: 'metro', precioUnitario: 2600, subtotal: 122200, fichaTecnicaURL: '' },
          { categoria: 'Cableado AC', marca: 'Genérico', modelo: 'Cable THHN 10AWG', cantidad: 20, unidad: 'metro', precioUnitario: 4200, subtotal: 84000, fichaTecnicaURL: '' },
          { categoria: 'Protección DC por string', marca: 'Genérico', modelo: 'Breaker DC 15A', cantidad: 2, unidad: 'unidad', precioUnitario: 48000, subtotal: 96000, fichaTecnicaURL: '' },
          { categoria: 'Protección AC general', marca: 'Genérico', modelo: 'Breaker AC 32A', cantidad: 1, unidad: 'unidad', precioUnitario: 78000, subtotal: 78000, fichaTecnicaURL: '' },
          { categoria: 'Protección contra sobretensiones (DPS)', marca: 'Genérico', modelo: 'DPS Clase II 40kA', cantidad: 1, unidad: 'unidad', precioUnitario: 185000, subtotal: 185000, fichaTecnicaURL: '' },
          { categoria: 'Conectores MC4', marca: 'Staubli', modelo: 'MC4 (par)', cantidad: 18, unidad: 'par', precioUnitario: 8500, subtotal: 153000, fichaTecnicaURL: '' },
          { categoria: 'Puesta a tierra', marca: 'Genérico', modelo: 'Kit puesta a tierra', cantidad: 1, unidad: 'kit', precioUnitario: 160000, subtotal: 160000, fichaTecnicaURL: '' },
          { categoria: 'Medidor bidireccional', marca: 'Genérico', modelo: 'Medidor bidireccional monofásico', cantidad: 1, unidad: 'unidad', precioUnitario: 360000, subtotal: 360000, fichaTecnicaURL: '' }
        ],
        advertencias: [], subtotalPanelesInversor: 9833000, subtotalMateriales: 2678200, totalMateriales: 12511200
      },
      financiero: { subtotalMateriales: 12511200, inversionEstimada: 14387880, ahorroMensual: 855000, ahorroAnual: 10260000, paybackMeses: 16.8, paybackAnos: 1.4, retorno25Anos: 242112120 },
      regulatorio: { dentroDeAGPE: true, limiteAGPEKwp: 1000, referenciaResolucion: 'Resolución CREG 174 de 2021 — Autogeneración a Pequeña Escala (AGPE), conectada al Sistema de Distribución Local.', notaRETIE: 'La instalación debe cumplir el Reglamento Técnico de Instalaciones Eléctricas (RETIE) vigente.', notaLey1715: 'Proyecto acogido a los beneficios de la Ley 1715 de 2014 para fuentes no convencionales de energía (sujeto a verificación tributaria del cliente).' },
      opcionesCompatibles: 3,
      diagramaSVG: '<svg viewBox="0 0 1190 100" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Roboto, sans-serif"><rect x="0" y="0" width="1190" height="100" fill="#0a0a0a"/><rect x="20" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="85" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">12 panel(es) en serie  ×2 strings</text><line x1="150" y1="50" x2="182" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="182,45 190,50 182,55" fill="#00e5ff"/><rect x="190" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="255" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Protección DC</text><text x="255" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">12.93 A</text><line x1="320" y1="50" x2="352" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="352,45 360,50 352,55" fill="#00e5ff"/><rect x="360" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="425" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Inversor</text><text x="425" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">Livoltek GT1-6KD2</text><line x1="490" y1="50" x2="522" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="522,45 530,50 522,55" fill="#00e5ff"/><rect x="530" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="595" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Protección AC</text><text x="595" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">27.3 A</text><line x1="660" y1="50" x2="692" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="692,45 700,50 692,55" fill="#00e5ff"/><rect x="700" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="765" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">DPS</text><line x1="830" y1="50" x2="862" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="862,45 870,50 862,55" fill="#00e5ff"/><rect x="870" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="935" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Medidor</text><text x="935" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">bidireccional</text><line x1="1000" y1="50" x2="1032" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="1032,45 1040,50 1032,55" fill="#00e5ff"/><rect x="1040" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="1105" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">Red eléctrica</text></svg>'
    }
  },
  {
    name: 'CASE-005',
    engine: 'mixto',
    input: { consumoMensualKWh: 350, ciudad: 'Barranquilla', sistemaHibrido: true },
    expectedStatus: STATUS.PASS,
    notes: 'Batería — sistema híbrido. El motor elige la batería de MAYOR capacidad activa (Livoltek BLF51-5, 5kWh) sobre la de menor capacidad (Pylontech, 3.5kWh), sin verificar voltaje de batería contra el inversor elegido (GAP-ANALYSIS.md, punto 13 — gap real, no corregido en esta fase).',
    expectedLegacyOutput: {
      fueraDeAlcanceAGPE: false, metodoUsado: 'consumo',
      zona: { ciudad: 'Barranquilla', hspPromedio: 5.75, temperaturaMinima: 22, tarifaEnergiaCOP: 950 },
      demandaMaximaKW: null, consumoMensualKWh: 350, consumoDiarioKWh: 11.67,
      potenciaBrutaKwp: 2.03, potenciaAjustadaKwp: 2.54,
      panel: { id: 'P1', tipo: 'Panel', marca: 'Jinko Solar', modelo: 'JKM415M-54HL4-V', proveedor: 'Distribuidor Demo', potenciaW: 415, vocStc: 49.5, vmpStc: 41.4, iscStc: 10.34, coefTempVoc: -0.26, voltajeMaxEntradaDC: 0, mpptMinV: 0, mpptMaxV: 0, corrienteMaxPorMppt: 0, numeroMppt: 1, capacidadKWh: 0, corrienteA: 0, precio: 480000, fichaTecnicaURL: '', activo: true },
      inversor: { id: 'I1', tipo: 'Inversor', marca: 'Growatt', modelo: 'MIN 3000TL-X', proveedor: 'Distribuidor Demo', potenciaW: 3000, vocStc: 0, vmpStc: 0, iscStc: 0, coefTempVoc: 0, voltajeMaxEntradaDC: 500, mpptMinV: 80, mpptMaxV: 450, corrienteMaxPorMppt: 13.5, numeroMppt: 2, capacidadKWh: 0, corrienteA: 0, precio: 2100000, fichaTecnicaURL: '', activo: true },
      numPaneles: 7,
      verificacionString: { compatible: true, motivo: null, vocCorregidoV: 49.89, panelesPorString: 7, numeroStrings: 1, stringsPorMppt: 1, maxStringsPorMppt: 1, fusibleRecomendadoA: 12.93 },
      bom: {
        items: [
          { categoria: 'Estructura de montaje', marca: 'Genérica', modelo: 'Riel aluminio + ganchos (techo teja)', cantidad: 7, unidad: 'unidad', precioUnitario: 90000, subtotal: 630000, fichaTecnicaURL: '' },
          { categoria: 'Cableado DC', marca: 'Genérico', modelo: 'Cable solar 12AWG (4mm²)', cantidad: 29, unidad: 'metro', precioUnitario: 2600, subtotal: 75400, fichaTecnicaURL: '' },
          { categoria: 'Cableado AC', marca: 'Genérico', modelo: 'Cable THHN 10AWG', cantidad: 20, unidad: 'metro', precioUnitario: 4200, subtotal: 84000, fichaTecnicaURL: '' },
          { categoria: 'Protección DC por string', marca: 'Genérico', modelo: 'Breaker DC 15A', cantidad: 1, unidad: 'unidad', precioUnitario: 48000, subtotal: 48000, fichaTecnicaURL: '' },
          { categoria: 'Protección AC general', marca: 'Genérico', modelo: 'Breaker AC 20A', cantidad: 1, unidad: 'unidad', precioUnitario: 62000, subtotal: 62000, fichaTecnicaURL: '' },
          { categoria: 'Protección contra sobretensiones (DPS)', marca: 'Genérico', modelo: 'DPS Clase II 40kA', cantidad: 1, unidad: 'unidad', precioUnitario: 185000, subtotal: 185000, fichaTecnicaURL: '' },
          { categoria: 'Conectores MC4', marca: 'Staubli', modelo: 'MC4 (par)', cantidad: 8, unidad: 'par', precioUnitario: 8500, subtotal: 68000, fichaTecnicaURL: '' },
          { categoria: 'Puesta a tierra', marca: 'Genérico', modelo: 'Kit puesta a tierra', cantidad: 1, unidad: 'kit', precioUnitario: 160000, subtotal: 160000, fichaTecnicaURL: '' },
          { categoria: 'Medidor bidireccional', marca: 'Genérico', modelo: 'Medidor bidireccional monofásico', cantidad: 1, unidad: 'unidad', precioUnitario: 360000, subtotal: 360000, fichaTecnicaURL: '' },
          { categoria: 'Banco de baterías (autonomía 1 día)', marca: 'Livoltek', modelo: 'BLF51-5R31002', cantidad: 4, unidad: 'unidad', precioUnitario: 6094000, subtotal: 24376000, fichaTecnicaURL: '' }
        ],
        advertencias: [], subtotalPanelesInversor: 5460000, subtotalMateriales: 26048400, totalMateriales: 31508400
      },
      financiero: { subtotalMateriales: 31508400, inversionEstimada: 36234660, ahorroMensual: 332500, ahorroAnual: 3990000, paybackMeses: 109, paybackAnos: 9.1, retorno25Anos: 63515340 },
      regulatorio: { dentroDeAGPE: true, limiteAGPEKwp: 1000, referenciaResolucion: 'Resolución CREG 174 de 2021 — Autogeneración a Pequeña Escala (AGPE), conectada al Sistema de Distribución Local.', notaRETIE: 'La instalación debe cumplir el Reglamento Técnico de Instalaciones Eléctricas (RETIE) vigente.', notaLey1715: 'Proyecto acogido a los beneficios de la Ley 1715 de 2014 para fuentes no convencionales de energía (sujeto a verificación tributaria del cliente).' },
      opcionesCompatibles: 2,
      diagramaSVG: '<svg viewBox="0 0 1190 100" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Roboto, sans-serif"><rect x="0" y="0" width="1190" height="100" fill="#0a0a0a"/><rect x="20" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="85" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">7 panel(es) en serie</text><line x1="150" y1="50" x2="182" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="182,45 190,50 182,55" fill="#00e5ff"/><rect x="190" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="255" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Protección DC</text><text x="255" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">12.93 A</text><line x1="320" y1="50" x2="352" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="352,45 360,50 352,55" fill="#00e5ff"/><rect x="360" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="425" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Inversor</text><text x="425" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">Growatt MIN 3000TL-X</text><line x1="490" y1="50" x2="522" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="522,45 530,50 522,55" fill="#00e5ff"/><rect x="530" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="595" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Protección AC</text><text x="595" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">13.6 A</text><line x1="660" y1="50" x2="692" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="692,45 700,50 692,55" fill="#00e5ff"/><rect x="700" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="765" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">DPS</text><line x1="830" y1="50" x2="862" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="862,45 870,50 862,55" fill="#00e5ff"/><rect x="870" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="935" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Medidor</text><text x="935" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">bidireccional</text><line x1="1000" y1="50" x2="1032" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="1032,45 1040,50 1032,55" fill="#00e5ff"/><rect x="1040" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="1105" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">Red eléctrica</text></svg>'
    }
  },
  {
    name: 'CASE-006',
    engine: 'mixto',
    input: { consumoMensualKWh: 500, ciudad: 'Barranquilla' },
    expectedStatus: STATUS.PASS,
    notes: 'BOM — valida específicamente la composición de la lista de materiales (9 ítems, sin baterías, totalMateriales=7679800) para un sistema de tamaño intermedio.',
    expectedLegacyOutput: {
      fueraDeAlcanceAGPE: false, metodoUsado: 'consumo',
      zona: { ciudad: 'Barranquilla', hspPromedio: 5.75, temperaturaMinima: 22, tarifaEnergiaCOP: 950 },
      demandaMaximaKW: null, consumoMensualKWh: 500, consumoDiarioKWh: 16.67,
      potenciaBrutaKwp: 2.9, potenciaAjustadaKwp: 3.62,
      panel: { id: 'P1', tipo: 'Panel', marca: 'Jinko Solar', modelo: 'JKM415M-54HL4-V', proveedor: 'Distribuidor Demo', potenciaW: 415, vocStc: 49.5, vmpStc: 41.4, iscStc: 10.34, coefTempVoc: -0.26, voltajeMaxEntradaDC: 0, mpptMinV: 0, mpptMaxV: 0, corrienteMaxPorMppt: 0, numeroMppt: 1, capacidadKWh: 0, corrienteA: 0, precio: 480000, fichaTecnicaURL: '', activo: true },
      inversor: { id: 'EI2', tipo: 'Inversor', marca: 'Livoltek', modelo: 'GT1-3K3S1', proveedor: 'Energitel SAS', potenciaW: 3300, vocStc: 0, vmpStc: 0, iscStc: 0, coefTempVoc: 0, voltajeMaxEntradaDC: 550, mpptMinV: 50, mpptMaxV: 545, corrienteMaxPorMppt: 14, numeroMppt: 1, capacidadKWh: 0, corrienteA: 0, precio: 1480000, fichaTecnicaURL: '', activo: true },
      numPaneles: 9,
      verificacionString: { compatible: true, motivo: null, vocCorregidoV: 49.89, panelesPorString: 9, numeroStrings: 1, stringsPorMppt: 1, maxStringsPorMppt: 1, fusibleRecomendadoA: 12.93 },
      bom: {
        items: [
          { categoria: 'Estructura de montaje', marca: 'Genérica', modelo: 'Riel aluminio + ganchos (techo teja)', cantidad: 9, unidad: 'unidad', precioUnitario: 90000, subtotal: 810000, fichaTecnicaURL: '' },
          { categoria: 'Cableado DC', marca: 'Genérico', modelo: 'Cable solar 12AWG (4mm²)', cantidad: 33, unidad: 'metro', precioUnitario: 2600, subtotal: 85800, fichaTecnicaURL: '' },
          { categoria: 'Cableado AC', marca: 'Genérico', modelo: 'Cable THHN 10AWG', cantidad: 20, unidad: 'metro', precioUnitario: 4200, subtotal: 84000, fichaTecnicaURL: '' },
          { categoria: 'Protección DC por string', marca: 'Genérico', modelo: 'Breaker DC 15A', cantidad: 1, unidad: 'unidad', precioUnitario: 48000, subtotal: 48000, fichaTecnicaURL: '' },
          { categoria: 'Protección AC general', marca: 'Genérico', modelo: 'Breaker AC 20A', cantidad: 1, unidad: 'unidad', precioUnitario: 62000, subtotal: 62000, fichaTecnicaURL: '' },
          { categoria: 'Protección contra sobretensiones (DPS)', marca: 'Genérico', modelo: 'DPS Clase II 40kA', cantidad: 1, unidad: 'unidad', precioUnitario: 185000, subtotal: 185000, fichaTecnicaURL: '' },
          { categoria: 'Conectores MC4', marca: 'Staubli', modelo: 'MC4 (par)', cantidad: 10, unidad: 'par', precioUnitario: 8500, subtotal: 85000, fichaTecnicaURL: '' },
          { categoria: 'Puesta a tierra', marca: 'Genérico', modelo: 'Kit puesta a tierra', cantidad: 1, unidad: 'kit', precioUnitario: 160000, subtotal: 160000, fichaTecnicaURL: '' },
          { categoria: 'Medidor bidireccional', marca: 'Genérico', modelo: 'Medidor bidireccional monofásico', cantidad: 1, unidad: 'unidad', precioUnitario: 360000, subtotal: 360000, fichaTecnicaURL: '' }
        ],
        advertencias: [], subtotalPanelesInversor: 5800000, subtotalMateriales: 1879800, totalMateriales: 7679800
      },
      financiero: { subtotalMateriales: 7679800, inversionEstimada: 8831770, ahorroMensual: 475000, ahorroAnual: 5700000, paybackMeses: 18.6, paybackAnos: 1.5, retorno25Anos: 133668230 },
      regulatorio: { dentroDeAGPE: true, limiteAGPEKwp: 1000, referenciaResolucion: 'Resolución CREG 174 de 2021 — Autogeneración a Pequeña Escala (AGPE), conectada al Sistema de Distribución Local.', notaRETIE: 'La instalación debe cumplir el Reglamento Técnico de Instalaciones Eléctricas (RETIE) vigente.', notaLey1715: 'Proyecto acogido a los beneficios de la Ley 1715 de 2014 para fuentes no convencionales de energía (sujeto a verificación tributaria del cliente).' },
      opcionesCompatibles: 3,
      diagramaSVG: '<svg viewBox="0 0 1190 100" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Roboto, sans-serif"><rect x="0" y="0" width="1190" height="100" fill="#0a0a0a"/><rect x="20" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="85" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">9 panel(es) en serie</text><line x1="150" y1="50" x2="182" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="182,45 190,50 182,55" fill="#00e5ff"/><rect x="190" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="255" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Protección DC</text><text x="255" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">12.93 A</text><line x1="320" y1="50" x2="352" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="352,45 360,50 352,55" fill="#00e5ff"/><rect x="360" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="425" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Inversor</text><text x="425" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">Livoltek GT1-3K3S1</text><line x1="490" y1="50" x2="522" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="522,45 530,50 522,55" fill="#00e5ff"/><rect x="530" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="595" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Protección AC</text><text x="595" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">15 A</text><line x1="660" y1="50" x2="692" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="692,45 700,50 692,55" fill="#00e5ff"/><rect x="700" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="765" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">DPS</text><line x1="830" y1="50" x2="862" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="862,45 870,50 862,55" fill="#00e5ff"/><rect x="870" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="935" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Medidor</text><text x="935" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">bidireccional</text><line x1="1000" y1="50" x2="1032" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="1032,45 1040,50 1032,55" fill="#00e5ff"/><rect x="1040" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="1105" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">Red eléctrica</text></svg>'
    }
  },
  {
    name: 'CASE-007',
    engine: 'mixto',
    input: { demandaMaximaKW: 3, ciudad: 'Barranquilla' },
    expectedStatus: STATUS.PASS,
    notes: 'Unifilar — valida que diagramaSVG se genera desde el resultado real (contiene el modelo exacto del inversor elegido, la corriente de protección DC/AC calculada), no como texto independiente.',
    expectedLegacyOutput: {
      fueraDeAlcanceAGPE: false, metodoUsado: 'cargabilidad',
      zona: { ciudad: 'Barranquilla', hspPromedio: 5.75, temperaturaMinima: 22, tarifaEnergiaCOP: 950 },
      demandaMaximaKW: 3, consumoMensualKWh: null, consumoDiarioKWh: null,
      potenciaBrutaKwp: 3, potenciaAjustadaKwp: 3.75,
      panel: { id: 'P1', tipo: 'Panel', marca: 'Jinko Solar', modelo: 'JKM415M-54HL4-V', proveedor: 'Distribuidor Demo', potenciaW: 415, vocStc: 49.5, vmpStc: 41.4, iscStc: 10.34, coefTempVoc: -0.26, voltajeMaxEntradaDC: 0, mpptMinV: 0, mpptMaxV: 0, corrienteMaxPorMppt: 0, numeroMppt: 1, capacidadKWh: 0, corrienteA: 0, precio: 480000, fichaTecnicaURL: '', activo: true },
      inversor: { id: 'EI2', tipo: 'Inversor', marca: 'Livoltek', modelo: 'GT1-3K3S1', proveedor: 'Energitel SAS', potenciaW: 3300, vocStc: 0, vmpStc: 0, iscStc: 0, coefTempVoc: 0, voltajeMaxEntradaDC: 550, mpptMinV: 50, mpptMaxV: 545, corrienteMaxPorMppt: 14, numeroMppt: 1, capacidadKWh: 0, corrienteA: 0, precio: 1480000, fichaTecnicaURL: '', activo: true },
      numPaneles: 10,
      verificacionString: { compatible: true, motivo: null, vocCorregidoV: 49.89, panelesPorString: 10, numeroStrings: 1, stringsPorMppt: 1, maxStringsPorMppt: 1, fusibleRecomendadoA: 12.93 },
      bom: {
        items: [
          { categoria: 'Estructura de montaje', marca: 'Genérica', modelo: 'Riel aluminio + ganchos (techo teja)', cantidad: 10, unidad: 'unidad', precioUnitario: 90000, subtotal: 900000, fichaTecnicaURL: '' },
          { categoria: 'Cableado DC', marca: 'Genérico', modelo: 'Cable solar 12AWG (4mm²)', cantidad: 35, unidad: 'metro', precioUnitario: 2600, subtotal: 91000, fichaTecnicaURL: '' },
          { categoria: 'Cableado AC', marca: 'Genérico', modelo: 'Cable THHN 10AWG', cantidad: 20, unidad: 'metro', precioUnitario: 4200, subtotal: 84000, fichaTecnicaURL: '' },
          { categoria: 'Protección DC por string', marca: 'Genérico', modelo: 'Breaker DC 15A', cantidad: 1, unidad: 'unidad', precioUnitario: 48000, subtotal: 48000, fichaTecnicaURL: '' },
          { categoria: 'Protección AC general', marca: 'Genérico', modelo: 'Breaker AC 20A', cantidad: 1, unidad: 'unidad', precioUnitario: 62000, subtotal: 62000, fichaTecnicaURL: '' },
          { categoria: 'Protección contra sobretensiones (DPS)', marca: 'Genérico', modelo: 'DPS Clase II 40kA', cantidad: 1, unidad: 'unidad', precioUnitario: 185000, subtotal: 185000, fichaTecnicaURL: '' },
          { categoria: 'Conectores MC4', marca: 'Staubli', modelo: 'MC4 (par)', cantidad: 11, unidad: 'par', precioUnitario: 8500, subtotal: 93500, fichaTecnicaURL: '' },
          { categoria: 'Puesta a tierra', marca: 'Genérico', modelo: 'Kit puesta a tierra', cantidad: 1, unidad: 'kit', precioUnitario: 160000, subtotal: 160000, fichaTecnicaURL: '' },
          { categoria: 'Medidor bidireccional', marca: 'Genérico', modelo: 'Medidor bidireccional monofásico', cantidad: 1, unidad: 'unidad', precioUnitario: 360000, subtotal: 360000, fichaTecnicaURL: '' }
        ],
        advertencias: [], subtotalPanelesInversor: 6280000, subtotalMateriales: 1983500, totalMateriales: 8263500
      },
      financiero: { subtotalMateriales: 8263500, inversionEstimada: 9503025, ahorroMensual: 614531, ahorroAnual: 7374375, paybackMeses: 15.5, paybackAnos: 1.3, retorno25Anos: 174856350 },
      regulatorio: { dentroDeAGPE: true, limiteAGPEKwp: 1000, referenciaResolucion: 'Resolución CREG 174 de 2021 — Autogeneración a Pequeña Escala (AGPE), conectada al Sistema de Distribución Local.', notaRETIE: 'La instalación debe cumplir el Reglamento Técnico de Instalaciones Eléctricas (RETIE) vigente.', notaLey1715: 'Proyecto acogido a los beneficios de la Ley 1715 de 2014 para fuentes no convencionales de energía (sujeto a verificación tributaria del cliente).' },
      opcionesCompatibles: 3,
      diagramaSVG: '<svg viewBox="0 0 1190 100" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Roboto, sans-serif"><rect x="0" y="0" width="1190" height="100" fill="#0a0a0a"/><rect x="20" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="85" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">10 panel(es) en serie</text><line x1="150" y1="50" x2="182" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="182,45 190,50 182,55" fill="#00e5ff"/><rect x="190" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="255" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Protección DC</text><text x="255" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">12.93 A</text><line x1="320" y1="50" x2="352" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="352,45 360,50 352,55" fill="#00e5ff"/><rect x="360" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="425" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Inversor</text><text x="425" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">Livoltek GT1-3K3S1</text><line x1="490" y1="50" x2="522" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="522,45 530,50 522,55" fill="#00e5ff"/><rect x="530" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="595" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Protección AC</text><text x="595" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">15 A</text><line x1="660" y1="50" x2="692" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="692,45 700,50 692,55" fill="#00e5ff"/><rect x="700" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="765" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">DPS</text><line x1="830" y1="50" x2="862" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="862,45 870,50 862,55" fill="#00e5ff"/><rect x="870" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="935" y="43" fill="#e0e0e0" font-size="11" text-anchor="middle">Medidor</text><text x="935" y="57" fill="#e0e0e0" font-size="11" text-anchor="middle">bidireccional</text><line x1="1000" y1="50" x2="1032" y2="50" stroke="#00e5ff" stroke-width="1.5"/><polygon points="1032,45 1040,50 1032,55" fill="#00e5ff"/><rect x="1040" y="20" width="130" height="60" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/><text x="1105" y="50" fill="#e0e0e0" font-size="11" text-anchor="middle">Red eléctrica</text></svg>'
    }
  }
];
