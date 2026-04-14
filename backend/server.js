/**
 * =============================================================================
 * BACKEND API — Tornado CFD Simulation Server
 * =============================================================================
 *
 * Servidor Node.js + Express que sirve:
 *   - API REST para datos de simulación CFD
 *   - WebSocket para actualizaciones en tiempo real
 *   - Archivos estáticos generados por Python
 *
 * Rutas disponibles:
 *   GET  /api/health              → Estado del servidor
 *   GET  /api/simulation/data     → Datos completos del tornado
 *   GET  /api/simulation/stats    → Estadísticas de la simulación
 *   GET  /api/simulation/slice    → Corte 2D horizontal
 *   GET  /api/reynolds            → Análisis de Reynolds
 *   GET  /api/physics             → Constantes físicas del modelo
 *   POST /api/simulation/run      → Ejecutar pipeline Python
 *
 * WebSocket: ws://localhost:3001
 *   - Evento 'progress': progreso en tiempo real del pipeline
 *   - Evento 'complete': simulación finalizada
 * =============================================================================
 */

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const path      = require('path');
const fs        = require('fs');
const http      = require('http');
const { WebSocketServer } = require('ws');
const { exec, spawn }     = require('child_process');
const rateLimit = require('express-rate-limit');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const PORT      = process.env.PORT || 3001;
const DATA_DIR  = path.join(__dirname, '../frontend/public/data');
const PYTHON_DIR = path.join(__dirname, '../python_post');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

// ============================================================================
// MIDDLEWARES
// ============================================================================

// Seguridad HTTP headers (con CSP relajado para el frontend)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS: permitir el frontend React
app.use(cors({
  origin: [
    'http://localhost:5173',    // Vite dev server
    'http://localhost:3000',    // CRA dev server
    'http://127.0.0.1:5173'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logger HTTP
app.use(morgan('dev'));

// Parsear JSON
app.use(express.json());

// Rate limiting (evitar saturar el servidor)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100,
  message: { error: 'Demasiadas peticiones. Intenta en 1 minuto.' }
});
app.use('/api', limiter);

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Lee el archivo de datos CFD generado por Python.
 * Si no existe, genera datos sintéticos de demostración.
 */
function leerDatosCFD() {
  const dataPath = path.join(DATA_DIR, 'cfd_data.json');

  if (fs.existsSync(dataPath)) {
    try {
      const raw = fs.readFileSync(dataPath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('[API] Error leyendo cfd_data.json:', err.message);
    }
  }

  // Datos de demostración si no existen los datos generados
  console.log('[API] Generando datos sintéticos para demostración...');
  return generarDatosDemostracion();
}

/**
 * Genera datos sintéticos del vórtice de Burgers para demostración.
 * Se usa cuando el pipeline Python no se ha ejecutado aún.
 */
function generarDatosDemostracion() {
  const N = 40;   // Puntos por dimensión en el slice
  const rc = 0.3; // Radio del núcleo [m]
  const Gamma = 5.0;  // Circulación [m²/s]
  const nu = 1.48e-5; // Viscosidad cinemática del aire

  const x = [], y = [];
  const omega = [], velocity = [], pressure = [], reynolds = [], regime = [];

  // Calcular el campo del vórtice de Burgers analíticamente
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const xi = -2.0 + (4.0 * i) / (N - 1);
      const yj = -2.0 + (4.0 * j) / (N - 1);
      const r  = Math.sqrt(xi * xi + yj * yj);
      const rSafe = Math.max(r, 1e-6);

      // Vórtice de Burgers: δ = sqrt(ν/a), a=1.0
      const delta = Math.sqrt(nu / 1.0);
      const utheta = (Gamma / (2 * Math.PI * rSafe)) *
                     (1 - Math.exp(-rSafe * rSafe / (2 * delta * delta)));

      // Velocidad radial (inflow)
      const ur = -1.0 * rSafe / 2.0;

      // Updraft (vertical)
      const uz = 2.0 * Math.max(1 - Math.exp(-rSafe * rSafe / (2 * delta * delta)), 0);

      const magU = Math.sqrt(ur * ur + utheta * utheta + uz * uz);

      // Vorticidad ω_z (Rankine)
      const omegaZ = r <= rc
        ? Gamma / (Math.PI * rc * rc)
        : 0;

      // Presión (balance ciclostrófico integrado)
      const rhoAire = 1.225;
      const pVal = r <= rc
        ? -(rhoAire * Gamma * Gamma) / (8 * Math.PI * Math.PI * rc * rc)
          + rhoAire * (Gamma / (2 * Math.PI * rc * rc)) ** 2 * (r * r - rc * rc) / 2
        : -(rhoAire * Gamma * Gamma) / (8 * Math.PI * Math.PI * rSafe * rSafe);

      // Reynolds local (L = r)
      const Re = (magU * rSafe) / nu;

      x.push(parseFloat(xi.toFixed(4)));
      y.push(parseFloat(yj.toFixed(4)));
      omega.push(parseFloat(omegaZ.toFixed(4)));
      velocity.push(parseFloat(magU.toFixed(4)));
      pressure.push(parseFloat(pVal.toFixed(4)));
      reynolds.push(parseFloat(Re.toFixed(0)));
      regime.push(Re < 2300 ? 0 : Re < 4000 ? 1 : 2);
    }
  }

  // Streamlines helicoidales del tornado
  const streamlines = [];
  const nLines = 24;
  for (let l = 0; l < nLines; l++) {
    const angle0 = (l / nLines) * 2 * Math.PI;
    const r0 = 0.4 + (l % 4) * 0.3;
    const zVals = [], xLine = [], yLine = [];

    for (let k = 0; k < 100; k++) {
      const z  = 0.05 + (3.9 * k) / 99;
      const th = angle0 + 2.8 * z;
      const rL = r0 * (1 - 0.18 * z / 4.0);
      xLine.push(parseFloat((rL * Math.cos(th)).toFixed(4)));
      yLine.push(parseFloat((rL * Math.sin(th)).toFixed(4)));
      zVals.push(parseFloat(z.toFixed(4)));
    }
    streamlines.push({ x: xLine, y: yLine, z: zVals });
  }

  const maxVel   = Math.max(...velocity);
  const maxOmega = Math.max(...omega);

  return {
    metadata: {
      model:   'Burgers Vortex + k-epsilon RANS (Sintético)',
      solver:  'Demostración — Ejecuta python main.py para datos reales',
      grid:    '40×40 puntos (slice z=H/3)',
      domain:  '4m × 4m × 4m cilíndrico',
      fluid:   'Aire, ρ=1.225 kg/m³, ν=1.48e-5 m²/s'
    },
    statistics: {
      U_max:           parseFloat(maxVel.toFixed(2)),
      omega_max:       parseFloat(maxOmega.toFixed(2)),
      p_min:           parseFloat(Math.min(...pressure).toFixed(2)),
      Re_max:          parseFloat(Math.max(...reynolds).toFixed(0)),
      Re_medio:        parseFloat((reynolds.reduce((a,b)=>a+b,0)/reynolds.length).toFixed(0)),
      frac_laminar:    parseFloat((regime.filter(r=>r===0).length/regime.length).toFixed(4)),
      frac_transicion: parseFloat((regime.filter(r=>r===1).length/regime.length).toFixed(4)),
      frac_turbulento: parseFloat((regime.filter(r=>r===2).length/regime.length).toFixed(4))
    },
    streamlines,
    slice: { x, y, omega, velocity, pressure, reynolds, flow_regime: regime }
  };
}

// ============================================================================
// ESTADO DEL PIPELINE
// ============================================================================

/**
 * Estado de la última ejecución del pipeline Python.
 * Se actualiza en tiempo real vía WebSocket.
 */
let pipelineState = {
  running: false,
  progress: 0,
  step: 'idle',
  lastRun: null,
  error: null
};

// ============================================================================
// RUTAS API
// ============================================================================

/**
 * GET /api/health
 * Verifica que el servidor está activo.
 */
app.get('/api/health', (req, res) => {
  res.json({
    status:      'ok',
    timestamp:   new Date().toISOString(),
    version:     '1.0.0',
    dataReady:   fs.existsSync(path.join(DATA_DIR, 'cfd_data.json')),
    pipeline:    pipelineState.step
  });
});

/**
 * GET /api/simulation/data
 * Devuelve todos los datos del tornado (para visualización principal).
 *
 * Respuesta:
 *   metadata:   Info del modelo
 *   statistics: Valores max/min/medios
 *   streamlines: Array de N líneas {x, y, z}
 *   slice:       Datos del corte z (x, y, omega, velocity, pressure, reynolds)
 */
app.get('/api/simulation/data', (req, res) => {
  try {
    const data = leerDatosCFD();
    res.json({
      success: true,
      data,
      cached:  fs.existsSync(path.join(DATA_DIR, 'cfd_data.json')),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/simulation/stats
 * Solo las estadísticas clave (respuesta liviana).
 */
app.get('/api/simulation/stats', (req, res) => {
  try {
    const data = leerDatosCFD();
    res.json({
      success: true,
      stats:   data.statistics,
      metadata: data.metadata
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/simulation/slice?z=1.0
 * Corte 2D horizontal del dominio.
 */
app.get('/api/simulation/slice', (req, res) => {
  try {
    const data = leerDatosCFD();
    res.json({
      success: true,
      slice: data.slice,
      z_level: req.query.z || 'H/3'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/reynolds
 * Datos de Reynolds y clasificación de flujo para el panel de análisis.
 */
app.get('/api/reynolds', (req, res) => {
  try {
    const data = leerDatosCFD();
    const { statistics } = data;

    // Calcular régimen global
    const Re_global = statistics.Re_max;
    let regimen = 'Laminar';
    if (Re_global >= 4000) regimen = 'Turbulento';
    else if (Re_global >= 2300) regimen = 'Transición';

    res.json({
      success: true,
      reynolds: {
        global: {
          Re_max:   statistics.Re_max,
          Re_medio: statistics.Re_medio,
          regimen
        },
        distribucion: {
          laminar:    { fraccion: statistics.frac_laminar,    porcentaje: (statistics.frac_laminar    * 100).toFixed(1) },
          transicion: { fraccion: statistics.frac_transicion, porcentaje: (statistics.frac_transicion * 100).toFixed(1) },
          turbulento: { fraccion: statistics.frac_turbulento, porcentaje: (statistics.frac_turbulento * 100).toFixed(1) }
        },
        umbrales: {
          laminar_max:    2300,
          transicion_max: 4000,
          criterio: 'Reynolds (Osborne Reynolds, 1883)'
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/physics
 * Constantes físicas y modelo matemático del tornado.
 */
app.get('/api/physics', (req, res) => {
  res.json({
    success: true,
    physics: {
      fluid: {
        name:      'Aire (condiciones estándar)',
        rho:       { value: 1.225,   unit: 'kg/m³',  desc: 'Densidad a 15°C, 1 atm' },
        mu:        { value: 1.81e-5, unit: 'Pa·s',   desc: 'Viscosidad dinámica' },
        nu:        { value: 1.48e-5, unit: 'm²/s',   desc: 'Viscosidad cinemática ν=μ/ρ' }
      },
      domain: {
        radius:   { value: 2.0, unit: 'm', desc: 'Radio del dominio' },
        height:   { value: 4.0, unit: 'm', desc: 'Altura del dominio' },
        core_rc:  { value: 0.3, unit: 'm', desc: 'Radio del núcleo del vórtice' }
      },
      equations: [
        {
          name:  'Continuidad (Incompresible)',
          latex: '\\nabla \\cdot \\mathbf{u} = 0',
          desc:  'Conservación de masa: la divergencia del campo de velocidades es cero'
        },
        {
          name:  'Navier-Stokes (Momento)',
          latex: '\\frac{\\partial \\mathbf{u}}{\\partial t} + (\\mathbf{u}\\cdot\\nabla)\\mathbf{u} = -\\frac{\\nabla p}{\\rho} + \\nu \\nabla^2 \\mathbf{u}',
          desc:  'Conservación de momento: aceleración = presión + difusión viscosa'
        },
        {
          name:  'Vorticidad',
          latex: '\\boldsymbol{\\omega} = \\nabla \\times \\mathbf{u}',
          desc:  'Rotacional del campo de velocidades. Mide la rotación local del fluido'
        },
        {
          name:  'Número de Reynolds',
          latex: 'Re = \\frac{\\rho U L}{\\mu} = \\frac{UL}{\\nu}',
          desc:  'Cociente de fuerzas inerciales a viscosas. Re ≫ 1 → turbulencia'
        }
      ],
      vortex_models: [
        {
          name: 'Rankine Combinado',
          desc: 'Núcleo sólido + libre exterior. Discontinuidad en r=rc.',
          equations: {
            core:  'u_θ = Ω·r  (r < rc)',
            outer: 'u_θ = Γ/(2π·r)  (r > rc)'
          }
        },
        {
          name: 'Burgers Vortex',
          desc: 'Solución exacta N-S con estiramiento axial. Continuo y analítico.',
          equations: {
            azimuthal: 'u_θ = Γ/(2πr)·[1 - exp(-r²/2δ²)]',
            delta:     'δ = √(ν/a)  [radio de Burgers]'
          }
        }
      ],
      turbulence_model: {
        name: 'k-ε estándar (Launder-Spalding 1974)',
        type: 'RANS',
        equations: [
          'Dk/Dt = ∇·[(ν + νt/σk)∇k] + Pk - ε',
          'Dε/Dt = ∇·[(ν + νt/σε)∇ε] + C1ε·(ε/k)·Pk - C2ε·ε²/k',
          'νt = Cμ·k²/ε  [Cμ = 0.09]'
        ]
      }
    }
  });
});

/**
 * POST /api/simulation/run
 * Ejecuta el pipeline Python en segundo plano.
 * Transmite progreso por WebSocket.
 */
app.post('/api/simulation/run', (req, res) => {
  if (pipelineState.running) {
    return res.status(409).json({
      success: false,
      error: 'El pipeline ya está ejecutándose'
    });
  }

  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(PYTHON_DIR, 'main.py');

  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({
      success: false,
      error: `Script Python no encontrado: ${scriptPath}`
    });
  }

  pipelineState = { running: true, progress: 0, step: 'iniciando', lastRun: new Date(), error: null };
  broadcastWS({ type: 'progress', ...pipelineState });

  res.json({ success: true, message: 'Pipeline iniciado. Sigue el progreso por WebSocket.' });

  // Ejecutar Python asíncronamente
  const proc = spawn(pythonCmd, [scriptPath], { cwd: PYTHON_DIR });

  const steps = [
    { keyword: 'Paso 1', step: 'Inicializando parámetros',   progress: 10 },
    { keyword: 'Paso 2', step: 'Calculando velocidades 3D',   progress: 25 },
    { keyword: 'Paso 3', step: 'Calculando presión',          progress: 40 },
    { keyword: 'Paso 4', step: 'Calculando vorticidad',       progress: 55 },
    { keyword: 'Paso 5', step: 'Análisis Reynolds',           progress: 70 },
    { keyword: 'Paso 6', step: 'Exportando datos',            progress: 80 },
    { keyword: 'Paso 7', step: 'Generando visualizaciones',   progress: 90 },
    { keyword: 'COMPLETADO', step: 'Completado',              progress: 100 }
  ];

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    console.log('[Python]', text.trim());

    for (const s of steps) {
      if (text.includes(s.keyword)) {
        pipelineState = { ...pipelineState, step: s.step, progress: s.progress };
        broadcastWS({ type: 'progress', ...pipelineState });
        break;
      }
    }
  });

  proc.stderr.on('data', (data) => {
    console.error('[Python stderr]', data.toString());
  });

  proc.on('close', (code) => {
    if (code === 0) {
      pipelineState = { running: false, progress: 100, step: 'completado', lastRun: new Date(), error: null };
      broadcastWS({ type: 'complete', ...pipelineState });
      console.log('[API] ✓ Pipeline Python completado');
    } else {
      pipelineState = { running: false, progress: 0, step: 'error', lastRun: new Date(), error: `Código de salida: ${code}` };
      broadcastWS({ type: 'error', ...pipelineState });
      console.error('[API] ✗ Pipeline falló con código:', code);
    }
  });
});

// ============================================================================
// WEBSOCKET — Progreso en tiempo real
// ============================================================================

/**
 * Envía un mensaje JSON a todos los clientes WebSocket conectados.
 */
function broadcastWS(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('[WS] Nuevo cliente conectado');
  ws.send(JSON.stringify({ type: 'connected', pipeline: pipelineState }));

  ws.on('close', () => console.log('[WS] Cliente desconectado'));
  ws.on('error', (err) => console.error('[WS] Error:', err.message));
});

// ============================================================================
// INICIO DEL SERVIDOR
// ============================================================================

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  🌪️  Tornado CFD — API Server                ║
║  HTTP:      http://localhost:${PORT}            ║
║  WebSocket: ws://localhost:${PORT}              ║
║  Datos:     ${DATA_DIR.slice(-30)}...  ║
╚══════════════════════════════════════════════╝
  `);

  // Verificar si ya hay datos precalculados
  const cfdPath = path.join(DATA_DIR, 'cfd_data.json');
  if (fs.existsSync(cfdPath)) {
    console.log('[API] ✓ Datos CFD precalculados encontrados');
  } else {
    console.log('[API] ⚠ No hay datos precalculados.');
    console.log('[API]   Ejecuta: cd python_post && pip install -r requirements.txt && python main.py');
    console.log('[API]   O usa POST /api/simulation/run desde el frontend');
  }
});

module.exports = { app, server };
