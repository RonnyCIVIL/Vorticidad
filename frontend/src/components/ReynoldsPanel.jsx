/**
 * ReynoldsPanel.jsx
 * Panel lateral con análisis completo del número de Reynolds
 * y clasificación del régimen de flujo en el tornado.
 */

import React from 'react'

// ─── Función para formatear números grandes ────────────────────────────────

function formatNumber(n) {
  if (n === undefined || n === null) return '—'
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return n.toFixed ? n.toFixed(1) : String(n)
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────

export default function ReynoldsPanel({ stats }) {
  /**
   * stats: {
   *   Re_max, Re_medio,
   *   frac_laminar, frac_transicion, frac_turbulento
   * }
   */

  if (!stats) {
    return (
      <div className="panel-card">
        <div className="panel-header">
          <span className="panel-title"><span className="panel-icon">🔢</span> Reynolds</span>
        </div>
        <div className="panel-body">
          <div className="plot-loading" style={{ height: 120 }}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 2 }} />
          </div>
        </div>
      </div>
    )
  }

  const pctLam  = ((stats.frac_laminar    || 0) * 100).toFixed(1)
  const pctTran = ((stats.frac_transicion || 0) * 100).toFixed(1)
  const pctTurb = ((stats.frac_turbulento || 0) * 100).toFixed(1)

  const Re_max    = stats.Re_max    || 0
  const Re_medio  = stats.Re_medio  || 0

  // Régimen global del tornado (basado en Re_max)
  const regimen = Re_max >= 4000 ? 'Turbulento' : Re_max >= 2300 ? 'Transición' : 'Laminar'
  const regimenColor = { Turbulento: '#ff3d5a', Transición: '#ffd700', Laminar: '#2266ff' }[regimen]

  return (
    <div className="panel-card">
      <div className="panel-header">
        <span className="panel-title">
          <span className="panel-icon">🔢</span>
          Número de Reynolds
        </span>
        <span className="panel-badge" style={{
          background: `${regimenColor}18`,
          color: regimenColor,
          borderColor: `${regimenColor}44`
        }}>
          {regimen.toUpperCase()}
        </span>
      </div>

      <div className="panel-body" style={{ paddingTop: '1rem' }}>

        {/* Definición */}
        <div style={{ marginBottom: '1rem' }}>
          <div className="equation-formula" style={{ fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.5rem' }}>
            Re = ρ·U·L / μ = U·L / ν
          </div>
          <div className="equation-desc">
            Cociente de fuerzas <strong style={{ color: '#ff6b35' }}>inerciales</strong> a
            fuerzas <strong style={{ color: '#44aaff' }}>viscosas</strong>.
            Re grande → turbulencia dominante.
          </div>
        </div>

        {/* Valores numéricos */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div className="stat-row">
            <span className="stat-key">Re máximo (núcleo)</span>
            <span className="stat-val red">{formatNumber(Re_max)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-key">Re promedio (dominio)</span>
            <span className="stat-val cyan">{formatNumber(Re_medio)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-key">Umbral lam/trans</span>
            <span className="stat-val" style={{ color: '#4488ff' }}>Re = 2,300</span>
          </div>
          <div className="stat-row">
            <span className="stat-key">Umbral trans/turb</span>
            <span className="stat-val" style={{ color: '#ff4422' }}>Re = 4,000</span>
          </div>
        </div>

        {/* Barra de distribución */}
        <div style={{ marginBottom: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Distribución de Régimen
        </div>

        <div className="regime-bar">
          <div className="regime-bar-segment laminar"    style={{ width: `${pctLam}%` }}  title={`Laminar: ${pctLam}%`} />
          <div className="regime-bar-segment transicion" style={{ width: `${pctTran}%` }} title={`Transición: ${pctTran}%`} />
          <div className="regime-bar-segment turbulento" style={{ width: `${pctTurb}%` }} title={`Turbulento: ${pctTurb}%`} />
        </div>

        <div className="regime-labels">
          {[
            { cls: 'laminar',    pct: pctLam,  name: 'Laminar',    color: '#44aaff' },
            { cls: 'transicion', pct: pctTran, name: 'Transición', color: '#ffd000' },
            { cls: 'turbulento', pct: pctTurb, name: 'Turbulento', color: '#ff4422' }
          ].map(({ cls, pct, name, color }) => (
            <div className="regime-label-item" key={cls}>
              <span className="regime-pct" style={{ color }}>
                <span className={`regime-dot ${cls}`} />
                {pct}%
              </span>
              <span className="regime-name">{name}</span>
            </div>
          ))}
        </div>

        {/* Alert turbulencia */}
        {parseFloat(pctTurb) > 50 && (
          <div className="alert-box turbulent" style={{ marginTop: '1rem' }}>
            <span>⚠️</span>
            <div>
              <strong>{pctTurb}%</strong> del dominio es turbulento.
              Se requiere modelo k-ε o LES para resolución precisa.
            </div>
          </div>
        )}

        {/* Escalas de Kolmogorov estimadas */}
        <div style={{ marginTop: '1.25rem', marginBottom: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Escalas de Kolmogorov (Re = {formatNumber(Re_max)})
        </div>

        <div className="scales-grid">
          {[
            { sym: 'η',    val: estimarEta(Re_max),     label: 'Escala viscosa'   },
            { sym: 'τ_k',  val: estimarTau(Re_max),     label: 'Escala temporal'  },
            { sym: 'L/η',  val: estimarLeta(Re_max),    label: 'Sep. de escalas'  },
            { sym: 'Nᴅɴˢ', val: estimarDNS(Re_max),     label: 'Celdas p/ DNS'    }
          ].map(({ sym, val, label }) => (
            <div className="scale-item" key={sym}>
              <div className="scale-symbol">{sym}</div>
              <span className="scale-value">{val}</span>
              <span className="scale-label">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Estimaciones de Kolmogorov ────────────────────────────────────────────

function estimarEta(Re) {
  if (!Re || Re === 0) return '—'
  const L = 0.3, nu = 1.48e-5
  const U = Re * nu / L
  const eps = U ** 3 / L
  const eta = (nu ** 3 / eps) ** 0.25
  if (eta < 1e-3) return `${(eta * 1e6).toFixed(1)} μm`
  return `${(eta * 1000).toFixed(2)} mm`
}

function estimarTau(Re) {
  if (!Re || Re === 0) return '—'
  const L = 0.3, nu = 1.48e-5
  const U = Re * nu / L
  const eps = U ** 3 / L
  const tau = (nu / eps) ** 0.5
  if (tau < 1e-3) return `${(tau * 1e6).toFixed(1)} μs`
  return `${(tau * 1000).toFixed(2)} ms`
}

function estimarLeta(Re) {
  if (!Re || Re === 0) return '—'
  const ratio = Re ** (3 / 4)
  if (ratio > 1e6) return `${(ratio / 1e6).toFixed(1)}M`
  if (ratio > 1e3) return `${(ratio / 1e3).toFixed(0)}k`
  return ratio.toFixed(0)
}

function estimarDNS(Re) {
  if (!Re || Re === 0) return '—'
  const n = Re ** (9 / 4)
  if (n > 1e15) return `${(n / 1e15).toFixed(1)} P`
  if (n > 1e12) return `${(n / 1e12).toFixed(1)} T`
  if (n > 1e9)  return `${(n / 1e9).toFixed(1)} G`
  if (n > 1e6)  return `${(n / 1e6).toFixed(1)} M`
  return n.toFixed(0)
}
