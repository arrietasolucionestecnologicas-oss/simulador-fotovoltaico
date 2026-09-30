/**
 * Fase A — Paso 2: Project Model como ADAPTADOR (ENGINEERING.md, sección "MODELO DE DATOS
 * CENTRAL").
 *
 * Esta fase NO reemplaza el objeto `datos` que usa `calcularSistema()` hoy. `toProjectModel` y
 * `fromProjectModel` son funciones puras de ida y vuelta: convierten el payload legacy al
 * Project Model y viceversa, para que fases futuras puedan empezar a construir sobre el Project
 * Model sin que el motor actual deje de recibir exactamente lo que espera. Ningún código de
 * `Code.gs` llama a estas funciones todavía — el motor legacy sigue recibiendo su `datos` de
 * siempre, sin pasar por aquí.
 *
 * Los dominios que el motor legacy no usa todavía (`solarResource`, `roof`, `topology`,
 * `strings`, `dcDesign`, `acDesign`, `protection`, `grounding`, `energySimulation`,
 * `documents`) quedan como objetos vacíos — son los huecos que GAP-ANALYSIS.md ya documentó,
 * no un intento de simular que existen.
 */

function toProjectModel(datos) {
  const d = datos || {};
  return {
    client: {
      nombre: d.cliente || null,
      tipo: d.tipoCliente || null
    },
    location: {
      ciudad: d.ciudad || null,
      direccion: d.direccion || null
    },
    electricalService: {
      metodoDimensionamiento: d.demandaMaximaKW ? 'cargabilidad' : 'consumo'
    },
    loadProfile: {
      consumoMensualKWh: (d.consumoMensualKWh !== undefined && d.consumoMensualKWh !== null) ? Number(d.consumoMensualKWh) : null,
      demandaMaximaKW: (d.demandaMaximaKW !== undefined && d.demandaMaximaKW !== null) ? Number(d.demandaMaximaKW) : null
    },
    solarResource: {},
    roof: {},
    module: {
      idForzado: d.panelId || null
    },
    inverter: {
      idForzado: d.inversorId || null
    },
    battery: {
      sistemaHibrido: !!d.sistemaHibrido
    },
    topology: {},
    strings: {},
    dcDesign: {},
    acDesign: {},
    protection: {},
    grounding: {},
    energySimulation: {},
    economics: {},
    regulatory: {},
    bom: {},
    documents: {},
    audit: {
      engineVersion: 'legacy-fase1',
      entries: []
    }
  };
}

/** Reconstruye el shape `datos` que `calcularSistema()` / `legacyCalculationEngine()` esperan. */
function fromProjectModel(project) {
  const p = project || {};
  const client = p.client || {};
  const location = p.location || {};
  const loadProfile = p.loadProfile || {};
  const module_ = p.module || {};
  const inverter = p.inverter || {};
  const battery = p.battery || {};

  return {
    cliente: client.nombre || '',
    tipoCliente: client.tipo || '',
    direccion: location.direccion || '',
    ciudad: location.ciudad || '',
    consumoMensualKWh: loadProfile.consumoMensualKWh || 0,
    demandaMaximaKW: loadProfile.demandaMaximaKW || 0,
    sistemaHibrido: !!battery.sistemaHibrido,
    panelId: module_.idForzado || undefined,
    inversorId: inverter.idForzado || undefined
  };
}
