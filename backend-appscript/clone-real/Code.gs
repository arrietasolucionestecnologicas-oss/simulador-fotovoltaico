/**
 * Simulador Fotovoltaico A.S.T. — Backend (Google Apps Script)
 * Fase 1: dimensionamiento (por consumo o por cargabilidad del recibo), catálogo,
 * verificación de string, lista de materiales (BOM), diagrama unifilar, módulo
 * financiero, chequeo regulatorio AGPE (Res. CREG 174/2021) y generador de
 * propuesta en PDF. Sin Google Solar API todavía (Fase 2).
 */

const PROPS = PropertiesService.getScriptProperties();

function getConfig_() {
  return {
    SHEET_ID: PROPS.getProperty('SHEET_ID'),
    DOC_TEMPLATE_ID: PROPS.getProperty('DOC_TEMPLATE_ID'),
    PDF_FOLDER_ID: PROPS.getProperty('PDF_FOLDER_ID'),
    API_KEY: PROPS.getProperty('API_KEY')
  };
}

// Límite regulatorio AGPE (Resolución CREG 174 de 2021): hasta 1 MW conectado al SDL.
const LIMITE_AGPE_KWP = 1000;
const MARGEN_PERDIDAS = 1.25;      // pérdidas de inversor, cableado y temperatura
const FACTOR_SEGURIDAD_ISC = 1.25; // NEC 690.8 / RETIE: fusible/breaker a 1.25x Isc del string
const COSTO_MANO_OBRA_PORC = 0.15; // instalación/mano de obra, % del subtotal de materiales
const AC_VOLTAJE = 220;            // supuesto: red monofásica 220V (ajustar si se soporta trifásico)
const METROS_DC_BASE = 15;         // heurística: homerun + margen, ajustable por proyecto real
const METROS_DC_POR_PANEL = 2;
const METROS_AC_BASE = 20;         // heurística: inversor → tablero eléctrico
const AUTONOMIA_BATERIA_DIAS = 1;
const DOD_BATERIA = 0.8;           // profundidad de descarga admisible
const EFICIENCIA_BATERIA = 0.95;

// ── Entradas HTTP ──────────────────────────────────────────────────────────

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true, service: 'Simulador Fotovoltaico A.S.T.', status: 'online'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond_({ success: false, error: 'JSON inválido' });
  }

  const config = getConfig_();
  if (config.API_KEY && body.auth !== config.API_KEY) {
    return respond_({ success: false, error: 'No autorizado' });
  }

  const action = body.action;
  const payload = body.payload || {};

  try {
    switch (action) {
      case 'calcular':
        return respond_({ success: true, data: calcularSistema(payload) });
      case 'getCatalogo':
        return respond_({ success: true, data: leerCatalogo_() });
      case 'getZonas':
        return respond_({ success: true, data: leerZonas_() });
      case 'guardarCatalogo':
        return respond_({ success: true, data: guardarItemCatalogo_(payload) });
      case 'eliminarCatalogo':
        return respond_({ success: true, data: eliminarItemCatalogo_(payload.id) });
      case 'guardarZona':
        return respond_({ success: true, data: guardarZona_(payload) });
      case 'eliminarZona':
        return respond_({ success: true, data: eliminarZona_(payload.ciudad) });
      case 'generarPropuesta':
        return respond_({ success: true, data: generarPropuesta(payload) });
      default:
        return respond_({ success: false, error: 'Acción no reconocida: ' + action });
    }
  } catch (err) {
    return respond_({ success: false, error: err.message });
  }
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ── Motor de cálculo (sección 4) ───────────────────────────────────────────

/**
 * datos: {
 *   consumoMensualKWh?, demandaMaximaKW?,  // al menos uno de los dos (4.1 vs 4.2)
 *   ciudad, tipoCliente, sistemaHibrido?, panelId?, inversorId?
 * }
 * Si panelId/inversorId no vienen, el motor elige la combinación más económica compatible.
 */
function calcularSistema(datos) {
  const demandaMaximaKW = Number(datos.demandaMaximaKW) || 0;
  const consumoMensualKWh = Number(datos.consumoMensualKWh) || 0;

  if (!demandaMaximaKW && !consumoMensualKWh) {
    throw new Error('Debes ingresar el consumo mensual (kWh) o la demanda máxima del recibo (kW).');
  }

  const zona = obtenerZona_(datos.ciudad);

  let potenciaAjustadaKwp, potenciaBrutaKwp, consumoDiario, metodoUsado;
  if (demandaMaximaKW > 0) {
    // 4.2 — cargabilidad del recibo: más preciso que estimar por consumo promedio,
    // porque ya refleja la potencia comercial real que exige la instalación.
    metodoUsado = 'cargabilidad';
    potenciaBrutaKwp = demandaMaximaKW;
    potenciaAjustadaKwp = demandaMaximaKW * MARGEN_PERDIDAS;
    consumoDiario = consumoMensualKWh > 0 ? consumoMensualKWh / 30 : null;
  } else {
    // 4.1 — dimensionamiento por consumo (caso residencial típico)
    metodoUsado = 'consumo';
    consumoDiario = consumoMensualKWh / 30;
    potenciaBrutaKwp = consumoDiario / zona.hspPromedio;
    potenciaAjustadaKwp = potenciaBrutaKwp * MARGEN_PERDIDAS;
  }

  if (potenciaAjustadaKwp > LIMITE_AGPE_KWP) {
    return {
      fueraDeAlcanceAGPE: true,
      potenciaAjustadaKwp: round2_(potenciaAjustadaKwp),
      mensaje: 'Fuera del régimen AGPE, requiere otro trámite regulatorio (supera 1 MW instalado).'
    };
  }

  const catalogo = leerCatalogo_();
  const paneles = catalogo.filter(function (r) { return r.tipo === 'Panel' && r.activo; });
  const inversores = catalogo.filter(function (r) { return r.tipo === 'Inversor' && r.activo; });

  if (paneles.length === 0 || inversores.length === 0) {
    throw new Error('El catálogo no tiene paneles o inversores activos configurados.');
  }

  // ahorro mensual: usa el consumo real si se conoce, o lo estima a partir de la
  // generación esperada del sistema (necesario cuando solo se ingresó demanda máxima)
  const ahorroBaseKWh = consumoMensualKWh > 0
    ? consumoMensualKWh
    : potenciaAjustadaKwp * zona.hspPromedio * 30;

  const combinaciones = [];
  paneles.forEach(function (panel) {
    const numPaneles = Math.ceil((potenciaAjustadaKwp * 1000) / panel.potenciaW);
    inversores.forEach(function (inversor) {
      // el inversor debe tener una potencia AC nominal razonable frente al sistema, no solo
      // pasar la verificación de string (si no, un inversor de 1kW podría "colar" en un
      // sistema de 5kW solo porque el string calza en su ventana MPPT)
      const potenciaSistemaW = potenciaAjustadaKwp * 1000;
      const dentroDeRangoPotencia = inversor.potenciaW >= potenciaSistemaW * 0.7 &&
        inversor.potenciaW <= potenciaSistemaW * 1.3;
      if (!dentroDeRangoPotencia) return;

      const verificacion = verificarString_(panel, inversor, zona.temperaturaMinima, numPaneles);
      if (!verificacion.compatible) return;

      const bom = armarBOM_(catalogo, {
        numPaneles: numPaneles, panel: panel, inversor: inversor,
        verificacionString: verificacion, sistemaHibrido: !!datos.sistemaHibrido,
        consumoDiarioKWh: consumoDiario
      });
      const financiero = calcularFinanciero_(bom.totalMateriales, ahorroBaseKWh, zona.tarifaEnergiaCOP);
      combinaciones.push({
        panel: panel, inversor: inversor, numPaneles: numPaneles,
        verificacionString: verificacion, bom: bom, financiero: financiero
      });
    });
  });

  if (combinaciones.length === 0) {
    return {
      fueraDeAlcanceAGPE: false,
      potenciaAjustadaKwp: round2_(potenciaAjustadaKwp),
      numPanelesEstimado: null,
      error: 'Ningún inversor del catálogo es compatible con el string resultante para esta potencia. Revisa el catálogo o ajusta manualmente.'
    };
  }

  // filtro opcional: si el usuario ya eligió panel/inversor, respétalo si es compatible
  let elegida = combinaciones[0];
  if (datos.panelId && datos.inversorId) {
    const forzada = combinaciones.find(function (c) {
      return c.panel.id === datos.panelId && c.inversor.id === datos.inversorId;
    });
    if (forzada) elegida = forzada;
  } else {
    combinaciones.sort(function (a, b) { return a.financiero.inversionEstimada - b.financiero.inversionEstimada; });
    elegida = combinaciones[0];
  }

  const resultado = {
    fueraDeAlcanceAGPE: false,
    metodoUsado: metodoUsado,
    zona: zona,
    demandaMaximaKW: demandaMaximaKW || null,
    consumoMensualKWh: consumoMensualKWh || null,
    consumoDiarioKWh: consumoDiario !== null ? round2_(consumoDiario) : null,
    potenciaBrutaKwp: round2_(potenciaBrutaKwp),
    potenciaAjustadaKwp: round2_(potenciaAjustadaKwp),
    panel: elegida.panel,
    inversor: elegida.inversor,
    numPaneles: elegida.numPaneles,
    verificacionString: elegida.verificacionString,
    bom: elegida.bom,
    financiero: elegida.financiero,
    regulatorio: chequeoRegulatorio_(potenciaAjustadaKwp),
    opcionesCompatibles: combinaciones.length
  };
  resultado.diagramaSVG = generarDiagramaUnifilarSVG_(resultado);
  return resultado;
}

/**
 * Verificación técnica de string: temperatura, ventana MPPT y corriente máxima por MPPT.
 */
function verificarString_(panel, inversor, temperaturaMinima, numPanelesTotal) {
  // Voc corregido por temperatura (más frío → mayor Voc, coeficiente típico negativo en %/°C)
  const vocCorregido = panel.vocStc * (1 + (panel.coefTempVoc / 100) * (temperaturaMinima - 25));

  const maxSeriePorVoltaje = Math.floor(inversor.voltajeMaxEntradaDC / vocCorregido);
  const minSeriePorMppt = Math.ceil(inversor.mpptMinV / panel.vmpStc);
  const maxSeriePorMppt = Math.floor(inversor.mpptMaxV / panel.vmpStc);

  const nSerieMax = Math.min(maxSeriePorVoltaje, maxSeriePorMppt);
  const nSerieMin = minSeriePorMppt;

  if (nSerieMax < nSerieMin || nSerieMax < 1) {
    return { compatible: false, motivo: 'Ningún número de paneles en serie cabe en la ventana de voltaje/MPPT del inversor.' };
  }

  // no tiene sentido un string más largo que el total de paneles que pide el sistema
  const nSerie = Math.min(nSerieMax, numPanelesTotal);
  if (nSerie < nSerieMin) {
    return { compatible: false, motivo: 'El sistema necesita muy pocos paneles para alcanzar el voltaje mínimo de arranque (MPPT) de este inversor.' };
  }

  const maxStringsPorMppt = Math.floor(inversor.corrienteMaxPorMppt / (panel.iscStc * FACTOR_SEGURIDAD_ISC));
  if (maxStringsPorMppt < 1) {
    return { compatible: false, motivo: 'La corriente Isc del panel excede la corriente máxima por MPPT del inversor.' };
  }

  const numStrings = Math.ceil(numPanelesTotal / nSerie);
  const numMppt = inversor.numeroMppt || 1;
  const stringsPorMppt = Math.ceil(numStrings / numMppt);
  const cumpleCorriente = stringsPorMppt <= maxStringsPorMppt;

  return {
    compatible: cumpleCorriente,
    motivo: cumpleCorriente ? null : 'Se requieren más strings en paralelo de los que soporta cada MPPT.',
    vocCorregidoV: round2_(vocCorregido),
    panelesPorString: nSerie,
    numeroStrings: numStrings,
    stringsPorMppt: stringsPorMppt,
    maxStringsPorMppt: maxStringsPorMppt,
    fusibleRecomendadoA: round2_(panel.iscStc * FACTOR_SEGURIDAD_ISC)
  };
}

// ── Lista de materiales / BOM (sección 5.3) ────────────────────────────────

/**
 * Arma la lista de materiales completa a partir del catálogo: estructura, cableado
 * DC/AC (calibre según la corriente calculada), protecciones DC/AC, DPS, conectores
 * MC4, puesta a tierra, medidor bidireccional y, si aplica, banco de baterías.
 * Los metrajes de cable son una heurística de campo (ver constantes arriba) —
 * ajustables por proyecto real, no un cálculo de planos.
 */
function armarBOM_(catalogo, ctx) {
  const items = [];
  const advertencias = [];

  function porTipo(tipo) { return catalogo.filter(function (r) { return r.tipo === tipo && r.activo; }); }
  function masBarato(lista) {
    return lista.slice().sort(function (a, b) { return a.precio - b.precio; })[0];
  }
  function compatiblePorCorriente(lista, corrienteRequerida) {
    const validos = lista.filter(function (r) { return r.corrienteA >= corrienteRequerida; });
    return validos.length ? masBarato(validos) : null;
  }
  function agregar(categoria, item, cantidad, unidad) {
    if (!item) {
      advertencias.push('Falta configurar en el catálogo: ' + categoria + '.');
      return;
    }
    const subtotal = round0_(item.precio * cantidad);
    items.push({
      categoria: categoria, marca: item.marca, modelo: item.modelo,
      cantidad: cantidad, unidad: unidad, precioUnitario: item.precio,
      subtotal: subtotal, fichaTecnicaURL: item.fichaTecnicaURL || ''
    });
    return subtotal;
  }

  const numPaneles = ctx.numPaneles;
  const corrienteDC = ctx.verificacionString.fusibleRecomendadoA;
  const corrienteAC = round2_(ctx.inversor.potenciaW / AC_VOLTAJE);
  const numeroStrings = ctx.verificacionString.numeroStrings;

  agregar('Estructura de montaje', masBarato(porTipo('Estructura')), numPaneles, 'unidad');

  const metrosDC = METROS_DC_BASE + (numPaneles * METROS_DC_POR_PANEL);
  agregar('Cableado DC', compatiblePorCorriente(porTipo('CableDC'), corrienteDC), metrosDC, 'metro');

  agregar('Cableado AC', compatiblePorCorriente(porTipo('CableAC'), corrienteAC), METROS_AC_BASE, 'metro');

  agregar('Protección DC por string', compatiblePorCorriente(porTipo('ProteccionDC'), corrienteDC), numeroStrings, 'unidad');

  agregar('Protección AC general', compatiblePorCorriente(porTipo('ProteccionAC'), corrienteAC), 1, 'unidad');

  agregar('Protección contra sobretensiones (DPS)', masBarato(porTipo('DPS')), 1, 'unidad');

  agregar('Conectores MC4', masBarato(porTipo('ConectorMC4')), numPaneles + numeroStrings, 'par');

  agregar('Puesta a tierra', masBarato(porTipo('PuestaATierra')), 1, 'kit');

  agregar('Medidor bidireccional', masBarato(porTipo('Medidor')), 1, 'unidad');

  if (ctx.sistemaHibrido) {
    const baterias = porTipo('Bateria').filter(function (b) { return b.capacidadKWh > 0; });
    const mejorBateria = baterias.sort(function (a, b) { return b.capacidadKWh - a.capacidadKWh; })[0];
    if (mejorBateria) {
      const consumoDiarioRef = ctx.consumoDiarioKWh || (numPaneles * ctx.panel.potenciaW / 1000) * 4; // fallback: ~4 HSP equivalentes
      const capacidadDeseadaKWh = (consumoDiarioRef * AUTONOMIA_BATERIA_DIAS) / (DOD_BATERIA * EFICIENCIA_BATERIA);
      const cantidad = Math.max(1, Math.ceil(capacidadDeseadaKWh / mejorBateria.capacidadKWh));
      agregar('Banco de baterías (autonomía ' + AUTONOMIA_BATERIA_DIAS + ' día)', mejorBateria, cantidad, 'unidad');
    } else {
      advertencias.push('Sistema híbrido solicitado pero no hay baterías activas en el catálogo.');
    }
  }

  const totalPanelesInversor = (numPaneles * ctx.panel.precio) + ctx.inversor.precio;
  const totalBOM = items.reduce(function (acc, it) { return acc + it.subtotal; }, 0);
  const totalMateriales = round0_(totalPanelesInversor + totalBOM);

  return {
    items: items,
    advertencias: advertencias,
    subtotalPanelesInversor: round0_(totalPanelesInversor),
    subtotalMateriales: round0_(totalBOM),
    totalMateriales: totalMateriales
  };
}

// ── Diagrama unifilar (sección 5.4) ────────────────────────────────────────

/**
 * Diagrama unifilar simplificado en SVG para mostrar en la web app. Representa un
 * string representativo (con "×N" si hay varios en paralelo) — no es un plano
 * eléctrico certificable, es una ayuda visual rápida para la propuesta.
 */
function generarDiagramaUnifilarSVG_(resultado) {
  const vs = resultado.verificacionString;
  const corrienteAC = round1_(resultado.inversor.potenciaW / AC_VOLTAJE);
  const cajas = [
    (vs.panelesPorString + ' panel(es) en serie') + (vs.numeroStrings > 1 ? '  ×' + vs.numeroStrings + ' strings' : ''),
    'Protección DC\n' + vs.fusibleRecomendadoA + ' A',
    'Inversor\n' + resultado.inversor.marca + ' ' + resultado.inversor.modelo,
    'Protección AC\n' + corrienteAC + ' A',
    'DPS',
    'Medidor\nbidireccional',
    'Red eléctrica'
  ];

  const boxW = 130, boxH = 60, gap = 40, marginX = 20, marginY = 20;
  const totalW = cajas.length * boxW + (cajas.length - 1) * gap + marginX * 2;
  const totalH = boxH + marginY * 2;
  const cy = marginY + boxH / 2;

  let svg = '<svg viewBox="0 0 ' + totalW + ' ' + totalH + '" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Roboto, sans-serif">';
  svg += '<rect x="0" y="0" width="' + totalW + '" height="' + totalH + '" fill="#0a0a0a"/>';

  cajas.forEach(function (texto, i) {
    const x = marginX + i * (boxW + gap);
    svg += '<rect x="' + x + '" y="' + marginY + '" width="' + boxW + '" height="' + boxH +
      '" rx="8" fill="#141414" stroke="#00e5ff" stroke-width="1.5"/>';
    const lineas = texto.split('\n');
    const startY = cy - ((lineas.length - 1) * 7);
    lineas.forEach(function (linea, li) {
      svg += '<text x="' + (x + boxW / 2) + '" y="' + (startY + li * 14) +
        '" fill="#e0e0e0" font-size="11" text-anchor="middle">' + escapeXml_(linea) + '</text>';
    });
    if (i < cajas.length - 1) {
      const x1 = x + boxW, x2 = x + boxW + gap;
      svg += '<line x1="' + x1 + '" y1="' + cy + '" x2="' + (x2 - 8) + '" y2="' + cy + '" stroke="#00e5ff" stroke-width="1.5"/>';
      svg += '<polygon points="' + (x2 - 8) + ',' + (cy - 5) + ' ' + x2 + ',' + cy + ' ' + (x2 - 8) + ',' + (cy + 5) + '" fill="#00e5ff"/>';
    }
  });

  svg += '</svg>';
  return svg;
}

function escapeXml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Módulo financiero (sección 5.6) ────────────────────────────────────────

function calcularFinanciero_(totalMateriales, ahorroBaseKWh, tarifaEnergiaCOP) {
  const inversionEstimada = totalMateriales * (1 + COSTO_MANO_OBRA_PORC);
  const ahorroMensual = ahorroBaseKWh * tarifaEnergiaCOP;
  const ahorroAnual = ahorroMensual * 12;
  const paybackMeses = ahorroMensual > 0 ? inversionEstimada / ahorroMensual : null;
  const retorno25Anos = (ahorroAnual * 25) - inversionEstimada;

  return {
    subtotalMateriales: round0_(totalMateriales),
    inversionEstimada: round0_(inversionEstimada),
    ahorroMensual: round0_(ahorroMensual),
    ahorroAnual: round0_(ahorroAnual),
    paybackMeses: paybackMeses ? round1_(paybackMeses) : null,
    paybackAnos: paybackMeses ? round1_(paybackMeses / 12) : null,
    retorno25Anos: round0_(retorno25Anos)
  };
}

// ── Chequeo regulatorio (sección 5.7) ──────────────────────────────────────

function chequeoRegulatorio_(potenciaAjustadaKwp) {
  return {
    dentroDeAGPE: potenciaAjustadaKwp <= LIMITE_AGPE_KWP,
    limiteAGPEKwp: LIMITE_AGPE_KWP,
    referenciaResolucion: 'Resolución CREG 174 de 2021 — Autogeneración a Pequeña Escala (AGPE), conectada al Sistema de Distribución Local.',
    notaRETIE: 'La instalación debe cumplir el Reglamento Técnico de Instalaciones Eléctricas (RETIE) vigente.',
    notaLey1715: 'Proyecto acogido a los beneficios de la Ley 1715 de 2014 para fuentes no convencionales de energía (sujeto a verificación tributaria del cliente).'
  };
}

// ── Catálogo y zonas (Google Sheets) ───────────────────────────────────────

function abrirSheet_() {
  const config = getConfig_();
  if (!config.SHEET_ID) throw new Error('Falta configurar SHEET_ID en Propiedades del script.');
  return SpreadsheetApp.openById(config.SHEET_ID);
}

function leerCatalogo_() {
  const sh = abrirSheet_().getSheetByName('Catalogo');
  if (!sh) throw new Error('No existe la hoja "Catalogo".');
  const rows = sh.getDataRange().getValues();
  const headers = rows.shift();
  return rows.filter(function (r) { return r[0] !== ''; }).map(function (r) {
    const o = {};
    headers.forEach(function (h, i) { o[h] = r[i]; });
    return {
      id: o.ID, tipo: o.Tipo, marca: o.Marca, modelo: o.Modelo, proveedor: o.Proveedor || '',
      potenciaW: Number(o.PotenciaW) || 0,
      vocStc: Number(o.Voc_STC) || 0, vmpStc: Number(o.Vmp_STC) || 0, iscStc: Number(o.Isc_STC) || 0,
      coefTempVoc: Number(o.CoefTempVoc) || 0,
      voltajeMaxEntradaDC: Number(o.VoltajeMaxEntradaDC) || 0,
      mpptMinV: Number(o.MPPTMinV) || 0, mpptMaxV: Number(o.MPPTMaxV) || 0,
      corrienteMaxPorMppt: Number(o.CorrienteMaxPorMPPT) || 0,
      numeroMppt: Number(o.NumeroMPPT) || 1,
      capacidadKWh: Number(o.CapacidadKWh) || 0,
      corrienteA: Number(o.CorrienteA) || 0,
      precio: Number(o.Precio) || 0,
      fichaTecnicaURL: o.FichaTecnicaURL || '',
      activo: o.Activo === true || o.Activo === 'TRUE' || o.Activo === 'VERDADERO'
    };
  });
}

function leerZonas_() {
  const sh = abrirSheet_().getSheetByName('ParametrosZona');
  if (!sh) throw new Error('No existe la hoja "ParametrosZona".');
  const rows = sh.getDataRange().getValues();
  const headers = rows.shift();
  return rows.filter(function (r) { return r[0] !== ''; }).map(function (r) {
    const o = {};
    headers.forEach(function (h, i) { o[h] = r[i]; });
    return {
      ciudad: o.Ciudad,
      hspPromedio: Number(o.HSP_Promedio) || 0,
      temperaturaMinima: Number(o.TemperaturaMinima) || 0,
      tarifaEnergiaCOP: Number(o.TarifaEnergiaCOP) || 0
    };
  });
}

function obtenerZona_(ciudad) {
  const zonas = leerZonas_();
  const encontrada = zonas.find(function (z) { return z.ciudad === ciudad; });
  if (encontrada) return encontrada;
  const porDefecto = zonas.find(function (z) { return z.ciudad === 'Barranquilla'; });
  if (!porDefecto) throw new Error('No hay parámetros de zona configurados (falta al menos "Barranquilla" en ParametrosZona).');
  return porDefecto;
}

// ── Administración de catálogo y zonas desde la app (sin editar el Sheet a mano) ──

function encontrarFilaPorValor_(sh, columna, valor) {
  const total = sh.getLastRow();
  if (total < 2) return -1;
  const valores = sh.getRange(2, columna, total - 1, 1).getValues();
  for (let i = 0; i < valores.length; i++) {
    if (valores[i][0] === valor) return i + 2;
  }
  return -1;
}

const ENCABEZADOS_CATALOGO = [
  'ID', 'Tipo', 'Marca', 'Modelo', 'Proveedor', 'PotenciaW', 'Voc_STC', 'Vmp_STC', 'Isc_STC',
  'CoefTempVoc', 'VoltajeMaxEntradaDC', 'MPPTMinV', 'MPPTMaxV', 'CorrienteMaxPorMPPT',
  'NumeroMPPT', 'CapacidadKWh', 'CorrienteA', 'Precio', 'FichaTecnicaURL', 'Activo'
];

/**
 * Autocorrige hojas "Catalogo" creadas antes de que existiera la columna Proveedor
 * (u otras columnas nuevas que se agreguen a futuro). Solo reescribe el encabezado
 * si la hoja todavía no tiene filas de datos, para no desalinear datos existentes.
 */
function asegurarEncabezadosCatalogo_(sh) {
  const headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  const faltaAlguno = ENCABEZADOS_CATALOGO.some(function (h) { return headers.indexOf(h) === -1; });
  if (faltaAlguno && sh.getLastRow() <= 1) {
    sh.getRange(1, 1, 1, ENCABEZADOS_CATALOGO.length).setValues([ENCABEZADOS_CATALOGO]);
    return ENCABEZADOS_CATALOGO;
  }
  return headers;
}

/** payload: item del catálogo (ver leerCatalogo_ para los campos). Si trae `id` existente, actualiza esa fila; si no, crea una nueva. */
function guardarItemCatalogo_(item) {
  if (!item.tipo) throw new Error('Falta el tipo de equipo.');
  const sh = abrirSheet_().getSheetByName('Catalogo');
  if (!sh) throw new Error('No existe la hoja "Catalogo".');
  const headers = asegurarEncabezadosCatalogo_(sh);
  const id = item.id || Utilities.getUuid();

  const valoresPorHeader = {
    ID: id, Tipo: item.tipo, Marca: item.marca || '', Modelo: item.modelo || '',
    Proveedor: item.proveedor || '',
    PotenciaW: item.potenciaW || '', Voc_STC: item.vocStc || '', Vmp_STC: item.vmpStc || '',
    Isc_STC: item.iscStc || '', CoefTempVoc: item.coefTempVoc || '',
    VoltajeMaxEntradaDC: item.voltajeMaxEntradaDC || '', MPPTMinV: item.mpptMinV || '',
    MPPTMaxV: item.mpptMaxV || '', CorrienteMaxPorMPPT: item.corrienteMaxPorMppt || '',
    NumeroMPPT: item.numeroMppt || '', CapacidadKWh: item.capacidadKWh || '',
    CorrienteA: item.corrienteA || '', Precio: Number(item.precio) || 0,
    FichaTecnicaURL: item.fichaTecnicaURL || '', Activo: item.activo !== false
  };
  const fila = headers.map(function (h) { return valoresPorHeader.hasOwnProperty(h) ? valoresPorHeader[h] : ''; });

  const filaExistente = item.id ? encontrarFilaPorValor_(sh, headers.indexOf('ID') + 1, item.id) : -1;
  if (filaExistente > 0) {
    sh.getRange(filaExistente, 1, 1, fila.length).setValues([fila]);
  } else {
    sh.appendRow(fila);
  }
  return { id: id };
}

function eliminarItemCatalogo_(id) {
  if (!id) throw new Error('Falta el id del equipo a eliminar.');
  const sh = abrirSheet_().getSheetByName('Catalogo');
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const fila = encontrarFilaPorValor_(sh, headers.indexOf('ID') + 1, id);
  if (fila > 0) sh.deleteRow(fila);
  return { eliminado: fila > 0 };
}

/** payload: { ciudad, hspPromedio, temperaturaMinima, tarifaEnergiaCOP }. Si la ciudad ya existe, la actualiza. */
function guardarZona_(zona) {
  if (!zona.ciudad) throw new Error('Falta la ciudad.');
  const sh = abrirSheet_().getSheetByName('ParametrosZona');
  if (!sh) throw new Error('No existe la hoja "ParametrosZona".');
  const fila = [zona.ciudad, Number(zona.hspPromedio) || 0, Number(zona.temperaturaMinima) || 0, Number(zona.tarifaEnergiaCOP) || 0];
  const filaExistente = encontrarFilaPorValor_(sh, 1, zona.ciudad);
  if (filaExistente > 0) {
    sh.getRange(filaExistente, 1, 1, fila.length).setValues([fila]);
  } else {
    sh.appendRow(fila);
  }
  return { ciudad: zona.ciudad };
}

function eliminarZona_(ciudad) {
  if (!ciudad) throw new Error('Falta la ciudad a eliminar.');
  const sh = abrirSheet_().getSheetByName('ParametrosZona');
  const fila = encontrarFilaPorValor_(sh, 1, ciudad);
  if (fila > 0) sh.deleteRow(fila);
  return { eliminado: fila > 0 };
}

// ── Generador de propuesta PDF (sección 5.8) ───────────────────────────────

/**
 * datos: { cliente, direccion, ciudad, tipoCliente, consumoMensualKWh?, demandaMaximaKW?,
 *          sistemaHibrido?, panelId?, inversorId? }
 *
 * Nota: el diagrama unifilar gráfico (SVG) se muestra en la web app; en el PDF de
 * Google Docs se incluye como tabla de la cadena de elementos, porque Apps Script no
 * tiene una forma nativa confiable de insertar SVG/vectores en un Doc sin depender de
 * un servicio externo de conversión. Si más adelante se necesita el gráfico embebido
 * en el PDF, se puede evaluar en Fase 3.
 */
function generarPropuesta(datos) {
  const resultado = calcularSistema(datos);
  if (resultado.fueraDeAlcanceAGPE || resultado.error) {
    return { resultado: resultado, pdfUrl: null };
  }

  const config = getConfig_();
  if (!config.DOC_TEMPLATE_ID) throw new Error('Falta configurar DOC_TEMPLATE_ID en Propiedades del script.');

  const carpeta = config.PDF_FOLDER_ID ? DriveApp.getFolderById(config.PDF_FOLDER_ID) : DriveApp.getRootFolder();
  const nombreArchivo = 'Propuesta AGPE - ' + (datos.cliente || 'Cliente') + ' - ' + Utilities.formatDate(new Date(), 'GMT-5', 'yyyy-MM-dd');

  const copia = DriveApp.getFileById(config.DOC_TEMPLATE_ID).makeCopy(nombreArchivo, carpeta);
  const doc = DocumentApp.openById(copia.getId());
  const body = doc.getBody();

  const marcadores = {
    '{{FECHA}}': Utilities.formatDate(new Date(), 'GMT-5', 'dd/MM/yyyy'),
    '{{CLIENTE}}': datos.cliente || '',
    '{{DIRECCION}}': datos.direccion || '',
    '{{CIUDAD}}': datos.ciudad || '',
    '{{METODO_DIMENSIONAMIENTO}}': resultado.metodoUsado === 'cargabilidad'
      ? 'Demanda máxima del recibo (maxímetro): ' + resultado.demandaMaximaKW + ' kW'
      : 'Consumo mensual: ' + resultado.consumoMensualKWh + ' kWh',
    '{{POTENCIA_KWP}}': String(resultado.potenciaAjustadaKwp),
    '{{NUM_PANELES}}': String(resultado.numPaneles),
    '{{PANEL_MARCA_MODELO}}': resultado.panel.marca + ' ' + resultado.panel.modelo + ' (' + resultado.panel.potenciaW + ' Wp)',
    '{{INVERSOR_MARCA_MODELO}}': resultado.inversor.marca + ' ' + resultado.inversor.modelo,
    '{{PANELES_POR_STRING}}': String(resultado.verificacionString.panelesPorString),
    '{{NUMERO_STRINGS}}': String(resultado.verificacionString.numeroStrings),
    '{{INVERSION_ESTIMADA}}': formatearCOP_(resultado.financiero.inversionEstimada),
    '{{AHORRO_MENSUAL}}': formatearCOP_(resultado.financiero.ahorroMensual),
    '{{PAYBACK_ANOS}}': String(resultado.financiero.paybackAnos),
    '{{RETORNO_25_ANOS}}': formatearCOP_(resultado.financiero.retorno25Anos),
    '{{NOTA_RETIE}}': resultado.regulatorio.notaRETIE,
    '{{NOTA_LEY_1715}}': resultado.regulatorio.notaLey1715,
    '{{REFERENCIA_RESOLUCION}}': resultado.regulatorio.referenciaResolucion
  };
  Object.keys(marcadores).forEach(function (k) { body.replaceText(escapeRegex_(k), marcadores[k]); });

  insertarTablaEnMarcador_(body, '{{DIAGRAMA_UNIFILAR_TABLA}}', construirTablaDiagrama_(resultado));
  insertarTablaEnMarcador_(body, '{{BOM_TABLA}}', construirTablaBOM_(resultado.bom));

  doc.saveAndClose();

  const pdf = DriveApp.getFileById(copia.getId()).getAs('application/pdf');
  const pdfFile = carpeta.createFile(pdf).setName(nombreArchivo + '.pdf');
  DriveApp.getFileById(copia.getId()).setTrashed(true); // deja solo el PDF final

  registrarCotizacion_(datos, resultado, pdfFile.getUrl());

  return { resultado: resultado, pdfUrl: pdfFile.getUrl() };
}

/** Busca un párrafo que contenga el marcador exacto y lo reemplaza por una tabla. */
function insertarTablaEnMarcador_(body, marcador, filas) {
  const encontrado = body.findText(escapeRegex_(marcador));
  if (!encontrado) return;
  const elemento = encontrado.getElement().getParent();
  const index = body.getChildIndex(elemento);
  body.insertTable(index, filas);
  body.removeChild(elemento);
}

function construirTablaDiagrama_(resultado) {
  const vs = resultado.verificacionString;
  const corrienteAC = round1_(resultado.inversor.potenciaW / AC_VOLTAJE);
  return [
    ['Elemento', 'Detalle'],
    ['Paneles por string × strings', vs.panelesPorString + ' × ' + vs.numeroStrings],
    ['Protección DC', vs.fusibleRecomendadoA + ' A'],
    ['Inversor', resultado.inversor.marca + ' ' + resultado.inversor.modelo],
    ['Protección AC', corrienteAC + ' A'],
    ['DPS', 'Sí'],
    ['Medidor', 'Bidireccional'],
    ['Salida', 'Red eléctrica (SDL)']
  ];
}

function construirTablaBOM_(bom) {
  const filas = [['Ítem', 'Cant.', 'Unidad', 'Precio unitario', 'Subtotal']];
  bom.items.forEach(function (it) {
    filas.push([
      it.categoria + (it.marca ? ' — ' + it.marca + ' ' + it.modelo : ''),
      String(it.cantidad), it.unidad, formatearCOP_(it.precioUnitario), formatearCOP_(it.subtotal)
    ]);
  });
  filas.push(['TOTAL MATERIALES', '', '', '', formatearCOP_(bom.totalMateriales)]);
  return filas;
}

function registrarCotizacion_(datos, resultado, pdfUrl) {
  const sh = abrirSheet_().getSheetByName('Cotizaciones');
  if (!sh) return;
  sh.appendRow([
    Utilities.getUuid(), new Date(), datos.cliente || '', datos.direccion || '', datos.ciudad || '',
    resultado.metodoUsado || '', resultado.consumoMensualKWh || '', resultado.demandaMaximaKW || '',
    resultado.potenciaAjustadaKwp, resultado.numPaneles,
    resultado.panel.id, resultado.inversor.id,
    resultado.financiero.inversionEstimada, resultado.financiero.ahorroMensual,
    resultado.financiero.paybackMeses, resultado.financiero.retorno25Anos,
    resultado.fueraDeAlcanceAGPE || false, pdfUrl
  ]);
}

// ── Utilidades ──────────────────────────────────────────────────────────

function round0_(n) { return Math.round(n); }
function round1_(n) { return Math.round(n * 10) / 10; }
function round2_(n) { return Math.round(n * 100) / 100; }
function escapeRegex_(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function formatearCOP_(n) { return '$' + Math.round(n).toLocaleString('es-CO'); }

/**
 * Ejecutar UNA VEZ manualmente desde el editor de Apps Script para crear las hojas
 * "Catalogo", "ParametrosZona" y "Cotizaciones" con sus encabezados en el Sheet
 * configurado en SHEET_ID (Propiedades del script).
 */
function inicializarHojas() {
  const ss = abrirSheet_();

  crearHojaSiNoExiste_(ss, 'Catalogo', [
    'ID', 'Tipo', 'Marca', 'Modelo', 'Proveedor', 'PotenciaW', 'Voc_STC', 'Vmp_STC', 'Isc_STC',
    'CoefTempVoc', 'VoltajeMaxEntradaDC', 'MPPTMinV', 'MPPTMaxV', 'CorrienteMaxPorMPPT',
    'NumeroMPPT', 'CapacidadKWh', 'CorrienteA', 'Precio', 'FichaTecnicaURL', 'Activo'
  ]);

  crearHojaSiNoExiste_(ss, 'ParametrosZona', ['Ciudad', 'HSP_Promedio', 'TemperaturaMinima', 'TarifaEnergiaCOP']);
  const zonas = ss.getSheetByName('ParametrosZona');
  if (zonas.getLastRow() === 1) {
    zonas.appendRow(['Barranquilla', 5.75, 22, 950]);
  }

  crearHojaSiNoExiste_(ss, 'Cotizaciones', [
    'ID', 'Fecha', 'Cliente', 'Direccion', 'Ciudad', 'MetodoDimensionamiento',
    'ConsumoMensualKWh', 'DemandaMaximaKW', 'PotenciaKWp',
    'NumPaneles', 'PanelID', 'InversorID', 'InversionEstimada', 'AhorroMensual',
    'PaybackMeses', 'RetornoA25Anos', 'FueraDeAlcanceAGPE', 'PDFUrl'
  ]);
}

function crearHojaSiNoExiste_(ss, nombre, encabezados) {
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.appendRow(encabezados);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Ejecutar UNA VEZ (desde el editor o vía `clasp run`) para poner en marcha el
 * proyecto: crea el Google Sheet de base de datos, genera un API_KEY si no existe,
 * lo guarda en Propiedades del script y crea las hojas con `inicializarHojas()`.
 * Después de correrla, ya no hace falta volver a ejecutarla.
 */
function configurarProyectoInicial() {
  if (PROPS.getProperty('SHEET_ID')) {
    return { yaConfigurado: true, sheetId: PROPS.getProperty('SHEET_ID'), apiKey: PROPS.getProperty('API_KEY') };
  }
  const ss = SpreadsheetApp.create('A.S.T. — Simulador Fotovoltaico DB');
  PROPS.setProperty('SHEET_ID', ss.getId());
  if (!PROPS.getProperty('API_KEY')) {
    PROPS.setProperty('API_KEY', Utilities.getUuid());
  }
  inicializarHojas();
  return {
    yaConfigurado: false,
    sheetId: ss.getId(),
    sheetUrl: ss.getUrl(),
    apiKey: PROPS.getProperty('API_KEY')
  };
}

/**
 * Ejecutar UNA VEZ (desde el editor) para sembrar un catálogo de EJEMPLO en la hoja
 * "Catalogo" y así poder probar la app de inmediato. Estos son datos de muestra —
 * marcas, specs y precios inventados, no reales. La gestión real del catálogo
 * (agregar/editar/eliminar equipos y precios de proveedores) se hace desde la
 * pantalla "Catálogo" de la app — no hace falta volver a editar el Sheet a mano.
 * Esta función no hace nada si la hoja ya tiene filas, para no duplicar.
 */
function cargarCatalogoDemo_() {
  const sh = abrirSheet_().getSheetByName('Catalogo');
  if (!sh) throw new Error('No existe la hoja "Catalogo". Corre inicializarHojas() primero.');
  asegurarEncabezadosCatalogo_(sh);
  if (sh.getLastRow() > 1) {
    return { yaTeniaDatos: true, filas: sh.getLastRow() - 1 };
  }

  const filas = [
    ['P1', 'Panel', 'Jinko Solar', 'JKM415M-54HL4-V', 'Distribuidor Demo', 415, 49.5, 41.4, 10.34, -0.26, '', '', '', '', '', '', '', 480000, '', true],
    ['P2', 'Panel', 'Canadian Solar', 'CS6R-550MS', 'Distribuidor Demo', 550, 49.9, 41.8, 13.75, -0.29, '', '', '', '', '', '', '', 620000, '', true],
    ['I1', 'Inversor', 'Growatt', 'MIN 3000TL-X', 'Distribuidor Demo', 3000, '', '', '', '', 500, 80, 450, 13.5, 2, '', '', 2100000, '', true],
    ['I2', 'Inversor', 'Growatt', 'MIN 6000TL-X', 'Distribuidor Demo', 6000, '', '', '', '', 550, 100, 500, 13.5, 3, '', '', 3400000, '', true],
    ['I3', 'Inversor', 'Growatt', 'MOD 10KTL3-X', 'Distribuidor Demo', 10000, '', '', '', '', 1000, 160, 950, 26, 2, '', '', 6200000, '', true],
    ['BAT1', 'Bateria', 'Pylontech', 'US3000C', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', 3.5, '', 4300000, '', true],
    ['EST1', 'Estructura', 'Genérica', 'Riel aluminio + ganchos (techo teja)', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', '', 90000, '', true],
    ['CDC1', 'CableDC', 'Genérico', 'Cable solar 10AWG (6mm²)', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', 30, 3800, '', true],
    ['CDC2', 'CableDC', 'Genérico', 'Cable solar 12AWG (4mm²)', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', 20, 2600, '', true],
    ['CAC1', 'CableAC', 'Genérico', 'Cable THHN 10AWG', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', 30, 4200, '', true],
    ['CAC2', 'CableAC', 'Genérico', 'Cable THHN 8AWG', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', 40, 5800, '', true],
    ['PDC1', 'ProteccionDC', 'Genérico', 'Breaker DC 15A', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', 15, 48000, '', true],
    ['PDC2', 'ProteccionDC', 'Genérico', 'Breaker DC 20A', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', 20, 58000, '', true],
    ['PAC1', 'ProteccionAC', 'Genérico', 'Breaker AC 20A', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', 20, 62000, '', true],
    ['PAC2', 'ProteccionAC', 'Genérico', 'Breaker AC 32A', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', 32, 78000, '', true],
    ['DPS1', 'DPS', 'Genérico', 'DPS Clase II 40kA', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', '', 185000, '', true],
    ['MC41', 'ConectorMC4', 'Staubli', 'MC4 (par)', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', '', 8500, '', true],
    ['GND1', 'PuestaATierra', 'Genérico', 'Kit puesta a tierra', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', '', 160000, '', true],
    ['MED1', 'Medidor', 'Genérico', 'Medidor bidireccional monofásico', 'Distribuidor Demo', '', '', '', '', '', '', '', '', '', '', '', '', 360000, '', true]
  ];
  filas.forEach(function (fila) { sh.appendRow(fila); });

  return { yaTeniaDatos: false, filasAgregadas: filas.length };
}
