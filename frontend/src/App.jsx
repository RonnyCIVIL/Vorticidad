/**
 * App.jsx — Dashboard principal CFD Tornado
 * Orquesta todos los componentes y maneja el estado global.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import TornadoViewer from './components/TornadoViewer.jsx'
import ReynoldsPanel from './components/ReynoldsPanel.jsx'
import PhysicsExplainer from './components/PhysicsExplainer.jsx'
import TornadoAnimado from './components/TornadoAnimado.jsx'

const API_HOST = window.location.hostname;
const API_BASE = `http://${API_HOST}:3001/api`;

// ─── Tabs de visualización ────────────────────────────────────────────────

const VIZ_TABS = [
  { id: 'slice',  label: '🔲 Corte 2D',     desc: 'Corte horizontal del vórtice' },
  { id: 'radial', label: '📈 Perfil Radial', desc: 'u_θ(r), ω(r), p(r), Re(r)' },
  { id: '3d',     label: '🌐 Vista 3D',      desc: 'Streamlines + núcleo vorticoso' },
  { id: 'anim',   label: '🌪️ Tornado Realista', desc: 'Simulación animada' }
]

// ─── Tabs de sección ─────────────────────────────────────────────────────

const NAV_TABS = ['visualización', 'física', 'openfoam', 'pipeline']

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmt(n, dec = 2) {
  if (n === undefined || n === null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return Number(n).toFixed(dec)
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────

export default function App() {
  // Estado global
  const [cfdData,    setCfdData]    = useState(null)
  const [stats,      setStats]      = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [activeViz,  setActiveViz]  = useState('slice')
  const [activeNav,  setActiveNav]  = useState('visualización')
  const [serverOk,   setServerOk]   = useState(false)
  const [pipeline,   setPipeline]   = useState({ running: false, progress: 0, step: 'idle' })
  const [wsLogs,     setWsLogs]     = useState([])
  const wsRef = useRef(null)

  // ── Conexión WebSocket ─────────────────────────────────────────────────

  useEffect(() => {
    const ws = new WebSocket(`ws://${API_HOST}:3001`)
    wsRef.current = ws

    ws.onopen = () => {
      addLog('info', '⚡ WebSocket conectado al servidor')
    }

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'connected') {
          addLog('success', '✓ Servidor CFD en línea')
        } else if (msg.type === 'progress') {
          setPipeline({ running: true, progress: msg.progress, step: msg.step })
          addLog('info', `[${msg.progress}%] ${msg.step}`)
        } else if (msg.type === 'complete') {
          setPipeline({ running: false, progress: 100, step: 'completado' })
          addLog('success', '✓ Pipeline completado — recargando datos...')
          fetchData()
        } else if (msg.type === 'error') {
          setPipeline({ running: false, progress: 0, step: 'error' })
          addLog('error', `✗ Error: ${msg.error}`)
        }
      } catch {}
    }

    ws.onerror = () => addLog('warning', '⚠ WebSocket no disponible (modo demo)')
    ws.onclose = () => addLog('dim', 'WebSocket desconectado')

    return () => ws.close()
  }, [])

  function addLog(type, text) {
    setWsLogs(prev => [...prev.slice(-50), { type, text, time: new Date().toLocaleTimeString() }])
  }

  // ── Carga de datos ─────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Verificar health
      const health = await fetch(`${API_BASE}/health`).then(r => r.json())
      setServerOk(health.status === 'ok')
      addLog('success', `✓ Servidor OK — datos ${health.dataReady ? 'listos' : 'sintéticos'}`)

      // Obtener datos de simulación
      const resp = await fetch(`${API_BASE}/simulation/data`).then(r => r.json())
      if (resp.success) {
        setCfdData(resp.data)
        setStats(resp.data.statistics)
        addLog('success', `✓ ${resp.cached ? 'Datos CFD cargados' : 'Datos demo cargados'} — ${resp.data.slice?.x?.length ?? 0} puntos`)
      }
    } catch (err) {
      setError('No se puede conectar al servidor. Asegúrate de que `npm run dev` esté activo en /backend.')
      addLog('error', `✗ Error de conexión: ${err.message}`)
      // Intentar demo local
      generarDemoLocal()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Demo local (sin backend) — malla 60×60, Burgers suave ─────────────

  function generarDemoLocal() {
    // Parámetros físicos — vórtice de Burgers (solución exacta N-S)
    const N     = 60           // resolución de malla: 60×60
    const Gamma = 8.0          // circulación Γ [m²/s]
    const a     = 1.2          // tasa de estiramiento axial [1/s]
    const nu    = 1.48e-5      // viscosidad cinemática del aire [m²/s]
    const rho   = 1.225        // densidad del aire [kg/m³]
    const delta = Math.sqrt(nu / a)   // radio de Burgers δ = √(ν/a)
    const rc    = 4 * delta           // radio efectivo del núcleo

    // Arrays de malla 1D para ejes
    const xAxis = Array.from({ length: N }, (_, i) => -2.5 + 5.0 * i / (N - 1))
    const yAxis = Array.from({ length: N }, (_, j) => -2.5 + 5.0 * j / (N - 1))

    // Matrices 2D aplanadas (fila = y, columna = x → orden C)
    const x = [], y = [], omega = [], velocity = [], pressure = [], reynolds = [], flow_regime = []
    // También matrices 2D puras para los heatmaps Plotly
    const omegaZ  = []   // [j][i]  — vorticidad axial
    const velMag  = []   // magnitud de velocidad
    const pressMat= []   // presión
    const reyMat  = []   // Reynolds

    for (let j = 0; j < N; j++) {
      const omRow = [], velRow = [], pRow = [], reRow = []
      for (let i = 0; i < N; i++) {
        const xi = xAxis[i]
        const yj = yAxis[j]
        const r  = Math.sqrt(xi * xi + yj * yj)
        const rs = Math.max(r, 1e-9)

        // Velocidad tangencial — Burgers vortex (suave, sin discontinuidades)
        const expTerm = 1 - Math.exp(-rs * rs / (2 * delta * delta))
        const utheta  = (Gamma / (2 * Math.PI * rs)) * expTerm

        // Velocidad radial (inflow convergente)
        const ur = -a * rs / 2

        // Updraft vertical (crece con z; aquí evaluamos en z=H/2=2m)
        const uz = a * 2.0 * expTerm

        // Magnitud 3D
        const mag = Math.sqrt(ur * ur + utheta * utheta + uz * uz)

        // Vorticidad axial exacta (derivada analítica del vórtice de Burgers)
        const omZ = (Gamma / (2 * Math.PI * delta * delta)) * Math.exp(-rs * rs / (2 * delta * delta))

        // Presión ciclostrófica: dp/dr = ρ·u_θ²/r  → integral analítica
        // p(r) = -ρΓ²/(8π²) · [Ei(-r²/2δ²) - Ei(0)] ≈ formula simplificada
        const pVal = -(rho * Gamma * Gamma) / (8 * Math.PI * Math.PI) *
                     (1 / Math.max(rs * rs + delta * delta, 1e-9))

        // Reynolds local (escala = rc)
        const Re = (mag * rc) / nu

        x.push(+xi.toFixed(2)); y.push(+yj.toFixed(2))
        omega.push(+omZ.toFixed(4)); velocity.push(+mag.toFixed(4))
        pressure.push(+pVal.toFixed(4)); reynolds.push(Math.round(Re))
        flow_regime.push(Re < 2300 ? 0 : Re < 4000 ? 1 : 2)

        omRow.push(+omZ.toFixed(4))
        velRow.push(+mag.toFixed(4))
        pRow.push(+pVal.toFixed(6))
        reRow.push(Math.round(Re))
      }
      omegaZ.push(omRow)
      velMag.push(velRow)
      pressMat.push(pRow)
      reyMat.push(reRow)
    }

    // Streamlines helicoidales — 24 líneas en espiral
    const streamlines = Array.from({ length: 24 }, (_, l) => {
      const a0  = (l / 24) * 2 * Math.PI
      const r0  = 0.3 + (l % 6) * 0.32
      const nPt = 100
      const xs = [], ys = [], zs = []
      for (let k = 0; k < nPt; k++) {
        const z   = 0.05 + 3.9 * k / (nPt - 1)
        const r   = r0 * (1 - 0.15 * z / 4.0)
        const phi = a0 + 3.5 * z
        xs.push(+(r * Math.cos(phi)).toFixed(3))
        ys.push(+(r * Math.sin(phi)).toFixed(3))
        zs.push(+z.toFixed(3))
      }
      return { x: xs, y: ys, z: zs }
    })

    const U_max = Math.max(...velocity)
    const omMax = Math.max(...omega)

    const Re_arr = reynolds
    const Re_max  = Math.max(...Re_arr)
    const Re_med  = Math.round(Re_arr.reduce((a, b) => a + b, 0) / Re_arr.length)
    const fLam  = flow_regime.filter(r => r === 0).length / flow_regime.length
    const fTran = flow_regime.filter(r => r === 1).length / flow_regime.length
    const fTurb = flow_regime.filter(r => r === 2).length / flow_regime.length

    setCfdData({
      metadata: {
        model:   'Burgers Vortex + k-epsilon RANS (Sintético)',
        solver:  'Analítico exacto (Burgers 1948)',
        grid:    `${N}×${N} celdas`,
        domain:  '5m × 5m × 4m',
        fluid:   `Aire, ρ=${rho} kg/m³, ν=${nu.toExponential(2)} m²/s`,
        params:  `Γ=${Gamma} m²/s  a=${a} s⁻¹  rc=${rc.toFixed(4)} m  δ=${delta.toFixed(4)} m`
      },
      statistics: {
        U_max: +U_max.toFixed(2), omega_max: +omMax.toFixed(2),
        p_min: +Math.min(...pressure).toFixed(4), Re_max, Re_medio: Re_med,
        frac_laminar: fLam, frac_transicion: fTran, frac_turbulento: fTurb
      },
      streamlines,
      // Para scatter/perfil radial
      slice: { x, y, omega, velocity, pressure, reynolds, flow_regime },
      // Matrices 2D para heatmap Plotly (N×N)
      heatmap: {
        xAxis, yAxis,
        omegaZ,        // vorticidad axial [N][N]
        velMag,        // magnitud velocidad
        pressMat,      // presión ciclostrófica
        reyMat         // Reynolds local
      }
    })
    setStats({
      U_max: +U_max.toFixed(2), omega_max: +omMax.toFixed(2),
      Re_max, Re_medio: Re_med,
      frac_laminar: fLam, frac_transicion: fTran, frac_turbulento: fTurb
    })
    addLog('warning', `⚠ Demo local — Burgers Vortex analítico: N=${N}×${N}, Γ=${Gamma}, rc=${rc.toFixed(3)}m`)
  }

  // ── Ejecutar pipeline Python ───────────────────────────────────────────

  async function ejecutarPipeline() {
    try {
      addLog('info', '🚀 Iniciando pipeline Python...')
      setPipeline({ running: true, progress: 5, step: 'enviando solicitud' })
      const resp = await fetch(`${API_BASE}/simulation/run`, { method: 'POST' }).then(r => r.json())
      if (!resp.success) throw new Error(resp.error)
      addLog('success', '✓ Pipeline iniciado — sigue el progreso abajo')
    } catch (err) {
      addLog('error', `✗ No se pudo iniciar: ${err.message}`)
      setPipeline({ running: false, progress: 0, step: 'error' })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="app-container">
      <div className="app-content">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <header className="header">
          <div className="header-inner">

            <div className="header-brand">
              <span className="header-icon">🌪️</span>
              <div>
                <div className="header-title">Tornado CFD Dashboard</div>
                <div className="header-subtitle">OpenFOAM + Python + k-ε RANS</div>
              </div>
            </div>

            <nav className="header-nav">
              {NAV_TABS.map(tab => (
                <button
                  key={tab}
                  id={`nav-${tab}`}
                  className={`nav-btn ${activeNav === tab ? 'active' : ''}`}
                  onClick={() => setActiveNav(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {serverOk && <span className="glow-dot" title="Servidor activo" />}
              {stats?.Re_max > 4000 && (
                <span className="header-badge turbulent">Re≫4000 · Turbulento</span>
              )}
              <span className="header-badge ready">
                {cfdData?.metadata?.model?.includes('Demo') ? 'DEMO' : 'CFD'}
              </span>
            </div>

          </div>
        </header>

        {/* ── KPI CARDS ───────────────────────────────────────────────────── */}
        <section className="hero-section">
          <div className="hero-grid">
            {[
              { cls: 'cyan',   icon: '💨', label: 'Velocidad Máxima', val: fmt(stats?.U_max, 1), unit: 'm/s',    desc: 'Máximo en el núcleo del vórtice' },
              { cls: 'red',    icon: '🌀', label: 'Vorticidad Máx.',  val: fmt(stats?.omega_max, 1), unit: '1/s', desc: 'ω_z máximo — núcleo vorticoso' },
              { cls: 'purple', icon: '🔵', label: 'Presión Mínima',   val: fmt(stats?.p_min, 0), unit: 'Pa',      desc: 'Defecto de presión en el núcleo' },
              { cls: 'green',  icon: '🔢', label: 'Reynolds Máx.',    val: fmt(stats?.Re_max), unit: '',          desc: 'Re ≫ 4000 → Turbulento' }
            ].map(({ cls, icon, label, val, unit, desc }) => (
              <div key={label} className={`kpi-card ${cls}`}>
                <div className="kpi-label">{icon} {label}</div>
                <div className="kpi-value">
                  {loading ? '...' : val}
                  {unit && <span className="kpi-unit">{unit}</span>}
                </div>
                <div className="kpi-desc">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CONTENIDO PRINCIPAL ─────────────────────────────────────────── */}

        {/* TAB: VISUALIZACIÓN */}
        {activeNav === 'visualización' && (
          <div className="dashboard-grid">

            {/* Panel central: Visualización */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="panel-card">
                <div className="panel-header">
                  <span className="panel-title">
                    <span className="panel-icon">📊</span>
                    Visualización CFD — Vórtice Tornado 3D
                  </span>
                  <span className="panel-badge">
                    {cfdData?.metadata?.model ?? 'Cargando...'}
                  </span>
                </div>

                {/* Tabs de vista */}
                <div className="viz-tabs">
                  {VIZ_TABS.map(({ id, label, desc }) => (
                    <button
                      key={id}
                      id={`viz-tab-${id}`}
                      className={`viz-tab ${activeViz === id ? 'active' : ''}`}
                      onClick={() => setActiveViz(id)}
                      title={desc}
                    >
                      {label}
                    </button>
                  ))}
                  <button className="viz-tab" onClick={fetchData} title="Recargar datos">
                    🔄 Recargar
                  </button>
                </div>

                {/* Área de plot */}
                <div className="plot-container">
                  {loading ? (
                    <div className="plot-loading">
                      <div className="spinner" />
                      <span>Calculando campo vorticoso...</span>
                      <small style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Simulación analítica: Burgers + Rankine
                      </small>
                    </div>
                  ) : error && !cfdData ? (
                    <div className="plot-loading">
                      <span style={{ fontSize: '2rem' }}>⚠️</span>
                      <span style={{ color: 'var(--accent-orange)' }}>{error}</span>
                    </div>
                  ) : activeViz === 'anim' ? (
                    <TornadoAnimado simulationData={cfdData} />
                  ) : (
                    <TornadoViewer data={cfdData} activeTab={activeViz} />
                  )}
                </div>
              </div>

              {/* Info del modelo */}
              {cfdData?.metadata && (
                <div className="panel-card">
                  <div className="panel-header">
                    <span className="panel-title"><span className="panel-icon">ℹ️</span> Parámetros del Modelo</span>
                  </div>
                  <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', paddingTop: '1rem' }}>
                    {[
                      ['Modelo',       cfdData.metadata.model],
                      ['Solver',       cfdData.metadata.solver],
                      ['Malla',        cfdData.metadata.grid],
                      ['Dominio',      cfdData.metadata.domain || '4m × 4m × 4m'],
                      ['Fluido',       cfdData.metadata.fluid || 'Aire, ρ=1.225 kg/m³'],
                      ['Turbulencia',  'k-ε RANS (Launder-Spalding)']
                    ].map(([k, v]) => (
                      <div key={k} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                                            padding: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{k}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 500 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="sidebar">
              <ReynoldsPanel stats={stats} />
              <PhysicsExplainer />
            </div>

          </div>
        )}

        {/* TAB: FÍSICA */}
        {activeNav === 'física' && (
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem 3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <PhysicsExplainer />
            <div className="panel-card">
              <div className="panel-header">
                <span className="panel-title"><span className="panel-icon">🌪️</span> Modelos de Vórtice</span>
              </div>
              <div className="panel-body">
                {[
                  {
                    name: 'Vórtice de Rankine Combinado',
                    desc: 'Une un núcleo sólido (r < rc) con un vórtice potencial externo (r > rc).',
                    eqs: ['Núcleo:    u_θ = Ω·r  (ω_z = 2Ω = cte)', 'Exterior:  u_θ = Γ/(2π·r)  (ω_z = 0)'],
                    pro: 'Simple, analítico, discontinuidad en r=rc',
                    con: 'Gradiente infinito en rc → inestabilidad numérica',
                    color: '#00d4ff'
                  },
                  {
                    name: 'Vórtice de Burgers',
                    desc: 'Solución exacta de Navier-Stokes con estiramiento axial (stretching rate a).',
                    eqs: ['u_θ = Γ/(2πr)·[1−exp(−r²/2δ²)]', 'u_r = −a·r/2  (inflow)', 'u_z = a·z   (updraft)'],
                    pro: 'Continuo, analítico exacto, incluye viscosidad',
                    con: 'Axisimétrico (no captura asimetría real)',
                    color: '#ff3d5a'
                  },
                  {
                    name: 'Vórtice de Sullivan',
                    desc: 'Modelo de 2 celdas: downdraft en el núcleo + updraft anular. Más realista.',
                    eqs: ['u_r = −a·r·H(r)', 'u_θ = Sullivan (1959)', 'u_z = 2a·z·G(r)'],
                    pro: 'Estructura de 2 celdas (como tornados EF4-EF5)',
                    con: 'Mayor complejidad matemática',
                    color: '#7c4dff'
                  }
                ].map(({ name, desc, eqs, pro, con, color }) => (
                  <div key={name} className="equation-item" style={{ borderColor: `${color}33`, marginBottom: '1rem' }}>
                    <div className="equation-name" style={{ color }}>{name}</div>
                    <div className="equation-desc" style={{ marginBottom: '0.75rem' }}>{desc}</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#64d4b0',
                                  background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '0.5rem',
                                  marginBottom: '0.75rem', lineHeight: 1.8 }}>
                      {eqs.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem' }}>
                      <div><span style={{ color: '#00ff88' }}>✓ </span>{pro}</div>
                      <div><span style={{ color: '#ff4422' }}>✗ </span>{con}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: OPENFOAM */}
        {activeNav === 'openfoam' && (
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem 3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

            {/* Estructura de archivos */}
            <div className="panel-card">
              <div className="panel-header">
                <span className="panel-title"><span className="panel-icon">📁</span> Caso OpenFOAM</span>
                <span className="panel-badge">pimpleFoam + k-ε</span>
              </div>
              <div className="panel-body">
                {[
                  { title: '0/ — Condiciones Iniciales', color: '#00d4ff', items: [
                    { file: 'U',       desc: 'Campo de velocidad. Condición rotacional en la base del tornado.', type: 'fixedValue + inletOutlet' },
                    { file: 'p',       desc: 'Presión cinemática (p/ρ). Referencia 0 en la salida.', type: 'zeroGradient + totalPressure' },
                    { file: 'k',       desc: 'Energía cinética turbulenta k = 1.5(UI)². I=5%', type: 'turbulentIntensityKE' },
                    { file: 'epsilon', desc: 'Tasa de disipación ε = Cμ³/⁴k³/²/L', type: 'mixingLength' },
                    { file: 'nut',     desc: 'Viscosidad turbulenta νt = Cμk²/ε', type: 'nutkWallFunction' }
                  ]},
                  { title: 'constant/ — Propiedades Físicas', color: '#ff3d5a', items: [
                    { file: 'transportProperties', desc: 'ν = 1.48×10⁻⁵ m²/s (aire a 20°C)', type: 'Newtonian' },
                    { file: 'turbulenceProperties', desc: 'Modelo k-ε estándar activado', type: 'RAS kEpsilon' }
                  ]},
                  { title: 'system/ — Configuración Numérica', color: '#7c4dff', items: [
                    { file: 'blockMeshDict', desc: 'Malla cúbica 40×40×60 celdas, dominio 4×4×4m', type: 'hex grading 0.1' },
                    { file: 'controlDict',   desc: 'T=[0,10]s, Δt adaptativo, Co<0.9, escritura cada 0.1s', type: 'adjustableRunTime' },
                    { file: 'fvSchemes',     desc: 'Euler temporal, Gauss limitedLinear convectivo (2do orden)', type: 'Gauss linear' },
                    { file: 'fvSolution',    desc: 'GAMG para presión, PBiCGStab para U,k,ε', type: 'PIMPLE n=3,2' }
                  ]}
                ].map(({ title, color, items }) => (
                  <div key={title} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color, marginBottom: '0.75rem',
                                  paddingBottom: '0.4rem', borderBottom: `1px solid ${color}33` }}>
                      {title}
                    </div>
                    {items.map(({ file, desc, type }) => (
                      <div key={file} style={{ display: 'grid', gridTemplateColumns: '100px 1fr auto',
                                               gap: '0.75rem', padding: '0.5rem 0',
                                               borderBottom: '1px solid rgba(255,255,255,0.04)',
                                               alignItems: 'start', fontSize: '0.75rem' }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64d4b0', fontWeight: 500 }}>{file}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{desc}</span>
                        <span style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px',
                                       color: 'var(--text-muted)', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>{type}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Algoritmo PIMPLE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="panel-card">
                <div className="panel-header">
                  <span className="panel-title"><span className="panel-icon">⚙️</span> Algoritmo PIMPLE</span>
                </div>
                <div className="panel-body">
                  <div className="alert-box info" style={{ marginBottom: '1rem', fontSize: '0.75rem' }}>
                    <span>ℹ️</span>
                    <div>PIMPLE = PISO + SIMPLE híbrido. Permite Co &gt; 1 con estabilidad gracias a las iteraciones externas.</div>
                  </div>
                  {[
                    { n: '1', title: 'Predecir U*', desc: 'Resolver ecuación de momento con presión actual. Resultado: U* (no divergencia-libre).' },
                    { n: '2', title: 'Resolver ∇²p', desc: 'Ecuación de Poisson para presión: ∇²p = ∇·U*/Δt. Solver: GAMG (multigrid).' },
                    { n: '3', title: 'Corregir U', desc: 'U = U* - Δt·∇p*. Ahora ∇·U ≈ 0 (continuidad satisfecha).' },
                    { n: '4', title: 'Repetir', desc: 'Iterar nCorrectors=2 veces (PISO). Luego outer loop nOuterCorrectors=3 (PIMPLE).' },
                    { n: '5', title: 'Resolver k y ε', desc: 'Actualizar energía turbulenta k y disipación ε. Calcular νt = Cμ·k²/ε.' }
                  ].map(({ n, title, desc }) => (
                    <div key={n} style={{ display: 'flex', gap: '1rem', padding: '0.75rem 0',
                                          borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,212,255,0.15)',
                                    border: '1px solid rgba(0,212,255,0.3)', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', flexShrink: 0,
                                    color: 'var(--accent-cyan)', fontSize: '0.7rem', fontWeight: 700 }}>{n}</div>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{title}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-header">
                  <span className="panel-title"><span className="panel-icon">💻</span> Comandos de Ejecución</span>
                </div>
                <div className="panel-body">
                  <div className="terminal-log" style={{ maxHeight: 'none' }}>
                    {[
                      ['dim', '# 1. Configurar entorno OpenFOAM (Ubuntu/WSL)'],
                      ['info', 'source /opt/openfoam2312/etc/bashrc'],
                      ['dim', ''],
                      ['dim', '# 2. Ir al directorio del caso'],
                      ['', 'cd openfoam_case/'],
                      ['dim', ''],
                      ['dim', '# 3. Generar malla 3D'],
                      ['success', 'blockMesh'],
                      ['dim', '# Verificar calidad de malla'],
                      ['info', 'checkMesh'],
                      ['dim', ''],
                      ['dim', '# 4. Ejecutar simulación CFD'],
                      ['success', 'pimpleFoam | tee log.pimpleFoam'],
                      ['dim', ''],
                      ['dim', '# 5. Post-procesar vorticidad'],
                      ['info', 'postProcess -func vorticity'],
                      ['dim', ''],
                      ['dim', '# 6. Python post-procesamiento'],
                      ['success', 'cd ../python_post'],
                      ['success', 'pip install -r requirements.txt'],
                      ['success', 'python main.py'],
                    ].map(([cls, text], i) => (
                      <span key={i} className={`log-line ${cls}`}>{text || '\u00A0'}<br /></span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: PIPELINE */}
        {activeNav === 'pipeline' && (
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 2rem 3rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="panel-card">
              <div className="panel-header">
                <span className="panel-title"><span className="panel-icon">🚀</span> Pipeline Python — Ejecutar Simulación</span>
                <span className="panel-badge">{pipeline.running ? 'EN EJECUCIÓN' : pipeline.step === 'completado' ? 'LISTO' : 'INACTIVO'}</span>
              </div>
              <div className="panel-body">
                <div style={{ marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Ejecuta el pipeline completo: Burgers Vortex → Vorticidad → Reynolds → Visualización
                </div>

                {/* Progress */}
                <div className="progress-bar-wrap">
                  <div className="progress-bar-fill" style={{ width: `${pipeline.progress}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem',
                              color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  <span>{pipeline.step}</span>
                  <span>{pipeline.progress}%</span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  <button
                    id="btn-run-pipeline"
                    className="btn-primary"
                    onClick={ejecutarPipeline}
                    disabled={pipeline.running}
                  >
                    {pipeline.running ? '⏳ Ejecutando...' : '▶ Ejecutar Pipeline Python'}
                  </button>
                  <button className="btn-secondary" onClick={fetchData}>
                    🔄 Recargar Datos
                  </button>
                </div>

                {/* Pasos del pipeline */}
                <div style={{ marginBottom: '1.25rem' }}>
                  {[
                    { step: 1, name: 'Parámetros físicos',    desc: 'ρ, μ, ν, Γ, rc, δ_Burgers' },
                    { step: 2, name: 'Campo de velocidades',  desc: 'u_r, u_θ, u_z en malla 3D (60×72×80)' },
                    { step: 3, name: 'Campo de presión',      desc: 'Balance ciclostrófico dp/dr = ρu_θ²/r' },
                    { step: 4, name: 'Vorticidad ω = ∇×u',    desc: 'Diferencias finitas centradas (2do orden)' },
                    { step: 5, name: 'Análisis Reynolds',     desc: 'Re local, Kolmogorov, clasificación' },
                    { step: 6, name: 'Exportar datos',        desc: 'NPZ + JSON para API y frontend React' },
                    { step: 7, name: 'Visualizaciones',       desc: 'Plotly 3D + Corte 2D + GIF animación' }
                  ].map(({ step, name, desc }) => {
                    const done = pipeline.progress >= step * 14
                    const active = pipeline.running && pipeline.progress >= (step - 1) * 14 && !done
                    return (
                      <div key={step} style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0',
                                               borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '0.7rem', fontWeight: 700,
                                      background: done ? 'rgba(0,255,136,0.15)' : active ? 'rgba(0,212,255,0.15)' : 'rgba(0,0,0,0.3)',
                                      border: `1px solid ${done ? 'rgba(0,255,136,0.4)' : active ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                      color: done ? '#00ff88' : active ? '#00d4ff' : 'var(--text-muted)' }}>
                          {done ? '✓' : step}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600,
                                        color: done ? '#00ff88' : active ? '#00d4ff' : 'var(--text-primary)' }}>{name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{desc}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Log en tiempo real */}
            <div className="panel-card">
              <div className="panel-header">
                <span className="panel-title"><span className="panel-icon">📟</span> Log en Tiempo Real</span>
                <button className="btn-secondary" onClick={() => setWsLogs([])} style={{ fontSize: '0.7rem', padding: '3px 8px' }}>
                  Limpiar
                </button>
              </div>
              <div className="panel-body" style={{ paddingTop: '1rem' }}>
                <div className="terminal-log" style={{ maxHeight: '350px' }}>
                  {wsLogs.length === 0 ? (
                    <span className="log-line dim">Esperando eventos del servidor...</span>
                  ) : (
                    wsLogs.map((log, i) => (
                      <span key={i} className={`log-line ${log.type}`}>
                        <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>[{log.time}]</span>
                        {log.text}<br />
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
