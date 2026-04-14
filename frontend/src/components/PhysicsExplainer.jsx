/**
 * PhysicsExplainer.jsx
 * Panel con las ecuaciones fundamentales de la simulación CFD
 * y la estructura del caso OpenFOAM.
 */

import React, { useState } from 'react'

// ─── Datos de ecuaciones ───────────────────────────────────────────────────

const EQUATIONS = [
  {
    name: 'Continuidad (Incompresible)',
    formula: '∇·u = 0',
    terms: [
      { sym: '∇·u', desc: 'Divergencia del campo de velocidades' },
      { sym: '= 0', desc: 'Conservación de masa: el fluido no se comprime' }
    ],
    color: '#00d4ff',
    desc: 'La masa se conserva en cada punto. El fluido que entra a un volumen = el que sale.',
    physics: 'Limitación fundamental: obliga a resolver presión como multiplicador de Lagrange.'
  },
  {
    name: 'Navier-Stokes (Momento)',
    formula: '∂u/∂t + (u·∇)u = -∇p/ρ + ν∇²u',
    terms: [
      { sym: '∂u/∂t',          desc: 'Aceleración local (variación temporal)' },
      { sym: '(u·∇)u',         desc: 'Convección no-lineal — GENERA vorticidad' },
      { sym: '-∇p/ρ',          desc: 'Gradiente de presión (fuerza de presión)' },
      { sym: 'ν∇²u',           desc: 'Difusión viscosa (disipa energía → calor)' }
    ],
    color: '#ff3d5a',
    desc: 'F = ma por unidad de volumen. La no-linealidad (u·∇)u es la fuente de turbulencia.',
    physics: 'El término no-lineal convectivo acopla todas las escalas espaciales: causa el cascada de energía.'
  },
  {
    name: 'Vorticidad',
    formula: 'ω = ∇ × u',
    terms: [
      { sym: 'ω',    desc: 'Vorticidad [1/s] — rotación local' },
      { sym: '∇ × u', desc: 'Rotacional del campo de velocidades' }
    ],
    color: '#7c4dff',
    desc: 'Mide la rotación LOCAL del fluido. En el núcleo del tornado: ω = Γ/πrc² (constante).',
    physics: 'En el exterior irrotacional: ω=0. La discontinuidad en r=rc genera inestabilidad Kelvin-Helmholtz.'
  },
  {
    name: 'Número de Reynolds',
    formula: 'Re = U·L / ν = ρ·U·L / μ',
    terms: [
      { sym: 'U',  desc: 'Velocidad característica [m/s]' },
      { sym: 'L',  desc: 'Longitud característica [m]' },
      { sym: 'ν',  desc: 'Viscosidad cinemática ν = μ/ρ [m²/s]' }
    ],
    color: '#00ff88',
    desc: 'Re = Fuerzas inerciales / Fuerzas viscosas. Define el régimen del flujo.',
    physics: 'Osborne Reynolds (1883): descubrió la transición experimental en tuberías circulares.'
  }
]

// ─── Estructura de archivos OpenFOAM ──────────────────────────────────────

const OF_STRUCTURE = [
  { indent: 0, type: 'folder', text: 'tornado_case/', comment: '← Directorio raíz' },
  { indent: 1, type: 'folder', text: '0/',            comment: '← Condiciones iniciales (t=0)' },
  { indent: 2, type: 'file',   text: 'U',             comment: '  Velocidad [m/s]' },
  { indent: 2, type: 'file',   text: 'p',             comment: '  Presión [Pa/ρ]' },
  { indent: 2, type: 'file',   text: 'k',             comment: '  Energía turbulenta [m²/s²]' },
  { indent: 2, type: 'file',   text: 'epsilon',       comment: '  Disipación [m²/s³]' },
  { indent: 2, type: 'file',   text: 'nut',           comment: '  Viscosidad turbulenta [m²/s]' },
  { indent: 1, type: 'folder', text: 'constant/',     comment: '← Propiedades físicas y malla' },
  { indent: 2, type: 'file',   text: 'transportProperties', comment: 'ν del fluido' },
  { indent: 2, type: 'file',   text: 'turbulenceProperties', comment: 'Modelo k-ε' },
  { indent: 2, type: 'folder', text: 'polyMesh/',     comment: 'Geometría de malla' },
  { indent: 1, type: 'folder', text: 'system/',       comment: '← Configuración numérica' },
  { indent: 2, type: 'file',   text: 'blockMeshDict', comment: 'Generación de malla' },
  { indent: 2, type: 'file',   text: 'controlDict',   comment: 'Tiempo, output' },
  { indent: 2, type: 'file',   text: 'fvSchemes',     comment: 'Discretización' },
  { indent: 2, type: 'file',   text: 'fvSolution',    comment: 'Solver PIMPLE' }
]

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────

export default function PhysicsExplainer() {
  const [activeEq, setActiveEq] = useState(0)
  const [showStructure, setShowStructure] = useState(false)
  const eq = EQUATIONS[activeEq]

  return (
    <div className="panel-card" style={{ height: 'auto' }}>
      <div className="panel-header">
        <span className="panel-title">
          <span className="panel-icon">📐</span>
          Fundamentos Físicos
        </span>
        <button
          className="btn-secondary"
          onClick={() => setShowStructure(s => !s)}
          style={{ fontSize: '0.7rem', padding: '4px 10px' }}
        >
          {showStructure ? '📐 Ecuaciones' : '📁 OpenFOAM'}
        </button>
      </div>

      <div className="panel-body" style={{ paddingTop: '1rem' }}>

        {!showStructure ? (
          <>
            {/* Selector de ecuaciones */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {EQUATIONS.map((e, i) => (
                <button
                  key={i}
                  className={`viz-tab ${activeEq === i ? 'active' : ''}`}
                  onClick={() => setActiveEq(i)}
                  style={{ fontSize: '0.68rem', padding: '4px 10px',
                           ...(activeEq === i ? { borderColor: e.color, color: e.color,
                                                   background: `${e.color}14` } : {}) }}
                >
                  {['∇·u=0', 'N-S', 'ω=∇×u', 'Re'][i]}
                </button>
              ))}
            </div>

            {/* Ecuación activa */}
            <div className="equation-item" style={{ borderColor: `${eq.color}44`, marginBottom: '1rem' }}>
              <div className="equation-name" style={{ color: eq.color }}>{eq.name}</div>
              <div className="equation-formula" style={{ fontSize: '0.95rem', textAlign: 'center',
                                                         margin: '0.75rem 0', color: eq.color,
                                                         textShadow: `0 0 20px ${eq.color}66` }}>
                {eq.formula}
              </div>
              <div className="equation-desc" style={{ marginBottom: '0.75rem' }}>{eq.desc}</div>

              {/* Términos */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                {eq.terms.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px', fontSize: '0.72rem' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: eq.color,
                                   minWidth: '90px', fontWeight: 600 }}>{t.sym}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{t.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Nota de física adicional */}
            <div className="alert-box info" style={{ fontSize: '0.72rem' }}>
              <span>💡</span>
              <div>{eq.physics}</div>
            </div>

            {/* Modelo de turbulencia */}
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase',
                            letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                Modelo de Turbulencia (k-ε RANS)
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0.75rem',
                            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem',
                            color: '#64d4b0', lineHeight: 2.0, border: '1px solid rgba(0,212,255,0.1)' }}>
                <span style={{ color: '#6a8aaa' }}>{/* k-equation */}</span>
                Dk/Dt = ∇·[(ν+νt/σk)∇k] + Pk − ε<br/>
                Dε/Dt = ∇·[(ν+νt/σε)∇ε] + C1ε(ε/k)Pk − C2ε·ε²/k<br/>
                <span style={{ color: '#aa66ff' }}>νt = Cμ·k²/ε</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>[Cμ=0.09]</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Estructura OpenFOAM */}
            <div style={{ marginBottom: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Caso pimpleFoam — Solver transitorio RANS:
            </div>
            <div className="tree">
              {OF_STRUCTURE.map((item, i) => (
                <div key={i} style={{ paddingLeft: `${item.indent * 16}px` }}>
                  {item.type === 'folder' ? (
                    <>
                      <span style={{ color: '#666' }}>📂 </span>
                      <span className="tree-folder">{item.text}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: '#444' }}>📄 </span>
                      <span className="tree-file">{item.text}</span>
                    </>
                  )}
                  <span className="tree-comment">  {item.comment}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase',
                            letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                Comandos de ejecución (Linux/WSL)
              </div>
              <div className="terminal-log">
                <span className="log-line dim"># Fuente entorno OpenFOAM</span>
                <span className="log-line">source /opt/openfoam2312/etc/bashrc</span>
                <span className="log-line dim"># Generar malla</span>
                <span className="log-line info">blockMesh</span>
                <span className="log-line dim"># Verificar calidad</span>
                <span className="log-line info">checkMesh</span>
                <span className="log-line dim"># Ejecutar solver</span>
                <span className="log-line success">pimpleFoam | tee solver.log</span>
                <span className="log-line dim"># Post-procesar vorticidad</span>
                <span className="log-line info">postProcess -func vorticity</span>
                <span className="log-line dim"># Python post-procesamiento</span>
                <span className="log-line success">python main.py</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
