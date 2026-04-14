/**
 * TornadoViewer.jsx
 * Visualización 3D interactiva del tornado con Plotly.js
 * Soporta: Corte 2D, Perfil Radial, Vista 3D completa
 */

import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'

// ─── Paletas de color (inferno, viridis, plasma) ───────────────────────────

const INFERNO_SCALE = [
  [0.0, '#000004'], [0.1, '#160b39'], [0.2, '#420a68'],
  [0.3, '#6a176e'], [0.4, '#932667'], [0.5, '#bc3754'],
  [0.6, '#dd513a'], [0.7, '#f37651'], [0.8, '#fca50a'],
  [0.9, '#f6d746'], [1.0, '#fcffa4']
]

const VIRIDIS_SCALE = [
  [0.0, '#440154'], [0.2, '#31688e'], [0.4, '#35b779'],
  [0.6, '#6ece58'], [0.8, '#b5de2b'], [1.0, '#fde725']
]

const PLASMA_SCALE = [
  [0.0, '#0d0887'], [0.25, '#7e03a8'], [0.5, '#cc4778'],
  [0.75, '#f89540'], [1.0, '#f0f921']
]

// ─── LAYOUT BASE para todos los gráficos ──────────────────────────────────

const BASE_LAYOUT = {
  paper_bgcolor: 'rgba(6,13,24,0)',
  plot_bgcolor:  'rgba(11,21,40,0.8)',
  font: {
    color:  '#8bafd0',
    family: 'Inter, sans-serif',
    size:   11
  },
  margin: { l: 50, r: 20, t: 40, b: 50 },
  xaxis: {
    gridcolor:     '#1a2a3a',
    zerolinecolor: '#1a3050',
    linecolor:     '#1a2a4a'
  },
  yaxis: {
    gridcolor:     '#1a2a3a',
    zerolinecolor: '#1a3050',
    linecolor:     '#1a2a4a'
  }
}

const PLOTLY_CONFIG = {
  displayModeBar:  true,
  displaylogo:     false,
  responsive:      true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d'],
  toImageButtonOptions: { format: 'png', width: 1200, height: 800, scale: 2 }
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────

export default function TornadoViewer({ data, activeTab }) {
  /**
   * data: { slice: { x, y, omega, velocity, pressure, reynolds, flow_regime },
   *         streamlines: [...],
   *         statistics: { U_max, omega_max, ... } }
   */

  // ══════════════════════════════════════════════════════════════
  // TAB 1: Corte 2D — Heatmap continuo de campos CFD
  // ══════════════════════════════════════════════════════════════
  const plotSlice = useMemo(() => {
    if (!data?.heatmap && !data?.slice) return null

    // Preferir datos de malla 2D (heatmap) si están disponibles
    if (data.heatmap) {
      const { xAxis, yAxis, omegaZ, velMag, pressMat, reyMat } = data.heatmap

      // Clasificación de régimen: mapa de colores personalizado
      const regimeColors = reyMat.map(row =>
        row.map(re => re < 2300 ? 0 : re < 4000 ? 1 : 2)
      )

      const mkHeatmap = (z, colorscale, title, unit, colorbarX) => ({
        type:        'heatmap',
        x:           xAxis,
        y:           yAxis,
        z,
        colorscale,
        showscale:   true,
        colorbar: {
          title:      { text: `${unit}`, font: { color: '#8bafd0', size: 10 } },
          tickcolor:  '#8bafd0',
          tickfont:   { color: '#8bafd0', size: 9 },
          thickness:  12,
          len:        0.42,
          x:          colorbarX,
          xpad:       4
        },
        zsmooth:      'best',
        hovertemplate: `x=%{x:.2f}<br>y=%{y:.2f}<br>${unit}=%{z:.3f}<extra>${title}</extra>`
      })

      const traceOmega = mkHeatmap(omegaZ,   INFERNO_SCALE,  'ω [1/s]',  '|\u03c9| [1/s]', 0.47)
      const traceVel   = mkHeatmap(velMag,   VIRIDIS_SCALE,  'U [m/s]',  '|U| [m/s]',   1.0)
      const tracePres  = mkHeatmap(pressMat, PLASMA_SCALE,   'p [Pa]',   'p [Pa]',      0.47)
      const traceRey   = mkHeatmap(regimeColors,
        [[0, '#2266ff'], [0.5, '#ffd000'], [1, '#ff4422']],
        'Régimen', 'Régimen', 1.0)

      return { traceOmega, traceVel, tracePres, traceRey, useHeatmap: true }
    }

    // Fallback: scatter si no hay datos de malla 2D
    const { x, y, omega, velocity, pressure, reynolds, flow_regime } = data.slice

    const traceOmega = {
      type:     'scatter',
      x, y,
      mode:     'markers',
      name:     '|ω| Vorticidad',
      marker: {
        color:      omega,
        colorscale: INFERNO_SCALE,
        size:       5,
        opacity:    0.88,
        colorbar: {
          title:      { text: '|ω| [1/s]', font: { color: '#8bafd0', size: 11 } },
          tickcolor:  '#8bafd0',
          tickfont:   { color: '#8bafd0', size: 10 },
          thickness:  14,
          len:        0.8
        }
      },
      hovertemplate: 'x=%{x:.2f} m<br>y=%{y:.2f} m<br>|ω|=%{marker.color:.2f} 1/s<extra></extra>'
    }

    const traceVel = {
      type:     'scatter',
      x, y,
      mode:     'markers',
      name:     '|U| Velocidad',
      marker: {
        color:      velocity,
        colorscale: VIRIDIS_SCALE,
        size:       5,
        opacity:    0.88,
        colorbar: {
          title:      { text: '|U| [m/s]', font: { color: '#8bafd0', size: 11 } },
          tickcolor:  '#8bafd0',
          tickfont:   { color: '#8bafd0', size: 10 },
          thickness:  14,
          len:        0.8
        }
      },
      hovertemplate: 'x=%{x:.2f} m<br>y=%{y:.2f} m<br>|U|=%{marker.color:.2f} m/s<extra></extra>'
    }

    const tracePres = {
      type:     'scatter',
      x, y,
      mode:     'markers',
      name:     'Presión',
      marker: {
        color:      pressure,
        colorscale: PLASMA_SCALE,
        size:       5,
        opacity:    0.88,
        colorbar: {
          title:      { text: 'p [Pa]', font: { color: '#8bafd0', size: 11 } },
          tickcolor:  '#8bafd0',
          tickfont:   { color: '#8bafd0', size: 10 },
          thickness:  14,
          len:        0.8
        }
      },
      hovertemplate: 'x=%{x:.2f} m<br>y=%{y:.2f} m<br>p=%{marker.color:.2f} Pa<extra></extra>'
    }

    // Clasificación de flujo (0=lam, 1=trans, 2=turb)
    const reColors = flow_regime.map(r => ['#2266ff', '#ffcc00', '#ff3322'][r])
    const traceRey = {
      type:     'scatter',
      x, y,
      mode:     'markers',
      name:     'Régimen',
      marker: { color: reColors, size: 5, opacity: 0.82 },
      hovertemplate: 'x=%{x:.2f}<br>y=%{y:.2f}<br>Re=%{text}<extra></extra>',
      text: reynolds.map(r => r.toFixed(0))
    }

    const subTitles = [
      '<b>Vorticidad |ω| [1/s]</b>',
      '<b>Velocidad |U| [m/s]</b>',
      '<b>Presión p [Pa]</b>',
      '<b>Régimen de Flujo (Re)</b>'
    ]

    return {
      traces: [
        { trace: traceOmega, row: 1, col: 1 },
        { trace: traceVel,   row: 1, col: 2 },
        { trace: tracePres,  row: 2, col: 1 },
        { trace: traceRey,   row: 2, col: 2 }
      ],
      subTitles
    }
  }, [data])

  // ══════════════════════════════════════════════════════════════
  // TAB 2: Perfil radial (gráficas 2D)
  // ══════════════════════════════════════════════════════════════
  const plotRadial = useMemo(() => {
    if (!data?.slice) return null
    const { x, y, omega, velocity, pressure, reynolds } = data.slice

    // Calcular radio de cada punto
    const radii = x.map((xi, i) => Math.sqrt(xi ** 2 + y[i] ** 2))

    // Ordenar por radio
    const indices = Array.from({ length: radii.length }, (_, i) => i)
      .sort((a, b) => radii[a] - radii[b])

    const r_sorted  = indices.map(i => radii[i])
    const om_sorted = indices.map(i => omega[i])
    const v_sorted  = indices.map(i => velocity[i])
    const p_sorted  = indices.map(i => pressure[i])
    const re_sorted = indices.map(i => reynolds[i])

    return { r_sorted, om_sorted, v_sorted, p_sorted, re_sorted }
  }, [data])

  // ══════════════════════════════════════════════════════════════
  // TAB 3: Vista 3D
  // ══════════════════════════════════════════════════════════════
  const plot3D = useMemo(() => {
    if (!data?.streamlines || !data?.slice) return null

    const traces = []

    // Streamlines helicoidal
    for (const [i, line] of data.streamlines.entries()) {
      const nPts = line.z.length
      const colors = line.z.map(z => z / 4.0)  // Normalizado 0-1

      traces.push({
        type: 'scatter3d',
        x: line.x, y: line.y, z: line.z,
        mode: 'lines',
        line: {
          color:      line.z,
          colorscale: 'Blues',
          width:       2.5
        },
        opacity: 0.6,
        showlegend: false,
        hoverinfo: 'skip',
        name: `Stream ${i + 1}`
      })
    }

    // Puntos del núcleo (isosuperfície: alta vorticidad en z=H/3)
    const { x, y, omega, velocity } = data.slice
    const threshold = Math.max(...omega) * 0.18
    const coreX = [], coreY = [], coreOm = [], coreV = []
    for (let i = 0; i < x.length; i++) {
      if (omega[i] > threshold) {
        coreX.push(x[i]); coreY.push(y[i])
        coreOm.push(omega[i]); coreV.push(velocity[i])
      }
    }

    // Distribuir núcleo a lo largo de z (pilares del tornado)
    const zLevels = [0.2, 0.7, 1.2, 1.7, 2.2, 2.7, 3.2, 3.7]
    for (const z0 of zLevels) {
      const scale = 1 - z0 * 0.07  // El tornado se estrecha arriba
      traces.push({
        type: 'scatter3d',
        x: coreX.map(v => v * scale),
        y: coreY.map(v => v * scale),
        z: coreX.map(() => z0 + (Math.random() * 0.15)),
        mode: 'markers',
        marker: {
          color:      coreOm,
          colorscale: INFERNO_SCALE,
          size:       2.5,
          opacity:    0.45,
          colorbar: z0 === zLevels[0] ? {
            title:    { text: '|ω|', font: { color: '#8bafd0', size: 10 } },
            tickfont: { color: '#8bafd0', size: 9 },
            len:      0.6, thickness: 12
          } : undefined
        },
        showlegend: false,
        hovertemplate: `z=${z0.toFixed(1)} m<br>|ω|=%{marker.color:.1f}<extra></extra>`
      })
    }

    return traces
  }, [data])

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  if (!data) {
    return (
      <div className="plot-loading">
        <div className="spinner" />
        <span>Cargando datos de simulación...</span>
      </div>
    )
  }

  // ── Tab: Corte 2D ─────────────────────────────────────────────
  if (activeTab === 'slice') {
    // Heatmap continuo (datos de malla 2D disponibles)
    if (plotSlice?.useHeatmap) {
      const { traceOmega, traceVel, tracePres, traceRey } = plotSlice

      const withAxes = (trace, r, c) => ({
        ...trace,
        xaxis: r === 1 && c === 1 ? 'x'  : `x${(r - 1) * 2 + c}`,
        yaxis: r === 1 && c === 1 ? 'y'  : `y${(r - 1) * 2 + c}`
      })

      const subTitles = [
        '<b>Vorticidad |\u03c9| [1/s]</b>',
        '<b>Velocidad |U| [m/s]</b>',
        '<b>Presión p [Pa]</b>',
        '<b>Régimen (0=Lam · 1=Trans · 2=Turb)</b>'
      ]

      const layout = {
        ...BASE_LAYOUT,
        height: 520,
        grid:   { rows: 2, columns: 2, pattern: 'independent' },
        margin: { l: 50, r: 60, t: 55, b: 50 },
        annotations: subTitles.map((text, i) => ({
          text,
          xref: `x${i + 1} domain`, yref: `y${i + 1} domain`,
          x: 0.5, y: 1.1,
          xanchor: 'center', yanchor: 'bottom',
          showarrow: false,
          font: { size: 10.5, color: '#8bafd0' }
        }))
      }
      ;['', '2', '3', '4'].forEach(s => {
        layout[`xaxis${s}`] = { title: { text: 'x [m]', font: { color: '#6a8aaa', size: 10 } }, gridcolor: '#1a2a3a' }
        layout[`yaxis${s}`] = { title: { text: 'y [m]', font: { color: '#6a8aaa', size: 10 } }, gridcolor: '#1a2a3a',
                                 scaleanchor: s === '' ? 'x' : `x${s}`, scaleratio: 1 }
      })

      return (
        <Plot
          data={[
            withAxes(traceOmega, 1, 1),
            withAxes(traceVel,   1, 2),
            withAxes(tracePres,  2, 1),
            withAxes(traceRey,   2, 2)
          ]}
          layout={layout}
          config={PLOTLY_CONFIG}
          style={{ width: '100%', height: '520px' }}
          useResizeHandler
        />
      )
    }

    // Fallback scatter (sin malla 2D)
    if (!plotSlice) return <div className="plot-loading"><span>Sin datos de simulación</span></div>

    const allTraces = plotSlice.traces.map(t => ({
      ...t.trace,
      xaxis: `x${t.row === 1 && t.col === 1 ? '' : (t.row - 1) * 2 + t.col}`,
      yaxis: `y${t.row === 1 && t.col === 1 ? '' : (t.row - 1) * 2 + t.col}`
    }))

    // Configuración manual de los ejes para subplot 2x2
    const layoutGrid = {
      ...BASE_LAYOUT,
      height: 520,
      grid:   { rows: 2, columns: 2, pattern: 'independent' },
      annotations: plotSlice.subTitles.map((text, i) => ({
        text,
        xref: `x${i + 1} domain`, yref: `y${i + 1} domain`,
        x: 0.5, y: 1.08,
        xanchor: 'center', yanchor: 'bottom',
        showarrow: false,
        font: { size: 11, color: '#8bafd0' }
      })),
      margin: { l: 50, r: 50, t: 50, b: 50 }
    }

    // Ejes de cada subplot
    ;['', '2', '3', '4'].forEach((suffix) => {
      layoutGrid[`xaxis${suffix}`] = { gridcolor: '#1a2a3a', zerolinecolor: '#1a3050', title: { text: 'x [m]', font: { color: '#6a8aaa', size: 10 } } }
      layoutGrid[`yaxis${suffix}`] = { gridcolor: '#1a2a3a', zerolinecolor: '#1a3050', title: { text: 'y [m]', font: { color: '#6a8aaa', size: 10 } }, scaleanchor: `x${suffix}` }
    })

    return (
      <Plot
        data={allTraces}
        layout={layoutGrid}
        config={PLOTLY_CONFIG}
        style={{ width: '100%', height: '520px' }}
        useResizeHandler
      />
    )
  }

  // ── Tab: Perfil radial ────────────────────────────────────────
  if (activeTab === 'radial') {
    if (!plotRadial) return null
    const { r_sorted, om_sorted, v_sorted, p_sorted, re_sorted } = plotRadial
    const rc = 0.3

    const traces = [
      {
        x: r_sorted, y: om_sorted,
        type: 'scatter', mode: 'lines',
        name: '|ω| [1/s]',
        line: { color: '#ff3d5a', width: 2.5 },
        fill: 'tozeroy', fillcolor: 'rgba(255,61,90,0.08)',
        xaxis: 'x', yaxis: 'y',
        hovertemplate: 'r=%{x:.3f} m<br>|ω|=%{y:.2f}<extra></extra>'
      },
      {
        x: r_sorted, y: v_sorted,
        type: 'scatter', mode: 'lines',
        name: '|U| [m/s]',
        line: { color: '#00d4ff', width: 2.5 },
        fill: 'tozeroy', fillcolor: 'rgba(0,212,255,0.08)',
        xaxis: 'x2', yaxis: 'y2',
        hovertemplate: 'r=%{x:.3f} m<br>|U|=%{y:.2f}<extra></extra>'
      },
      {
        x: r_sorted, y: p_sorted,
        type: 'scatter', mode: 'lines',
        name: 'p [Pa]',
        line: { color: '#7c4dff', width: 2.5 },
        fill: 'tozeroy', fillcolor: 'rgba(124,77,255,0.08)',
        xaxis: 'x3', yaxis: 'y3',
        hovertemplate: 'r=%{x:.3f} m<br>p=%{y:.2f}<extra></extra>'
      },
      {
        x: r_sorted, y: re_sorted,
        type: 'scatter', mode: 'lines',
        name: 'Re',
        line: { color: '#00ff88', width: 2.5 },
        xaxis: 'x4', yaxis: 'y4'
      }
    ]

    const shapeVLine = (xref, col) => ({
      type: 'line', x0: rc, x1: rc, y0: 0, y1: 1,
      xref: `x${col}`, yref: `y${col} domain`,
      line: { color: '#ff6b35', dash: 'dash', width: 1.5 }
    })

    const layout = {
      ...BASE_LAYOUT,
      height:  520,
      grid:    { rows: 2, columns: 2, pattern: 'independent' },
      margin:  { l: 50, r: 30, t: 50, b: 50 },
      shapes:  ['', '2', '3', '4'].map((s, i) => shapeVLine(`x${s}`, s || '')),
      annotations: [
        { text: '<b>Vorticidad |ω|(r)</b>', xref: 'x domain', yref: 'y domain', x: 0.5, y: 1.1, xanchor: 'center', showarrow: false, font: { color: '#ff3d5a', size: 11 } },
        { text: '<b>Velocidad |U|(r)</b>',   xref: 'x2 domain', yref: 'y2 domain', x: 0.5, y: 1.1, xanchor: 'center', showarrow: false, font: { color: '#00d4ff', size: 11 } },
        { text: '<b>Presión p(r)</b>',        xref: 'x3 domain', yref: 'y3 domain', x: 0.5, y: 1.1, xanchor: 'center', showarrow: false, font: { color: '#7c4dff', size: 11 } },
        { text: '<b>Reynolds Re(r)</b>',       xref: 'x4 domain', yref: 'y4 domain', x: 0.5, y: 1.1, xanchor: 'center', showarrow: false, font: { color: '#00ff88', size: 11 } }
      ]
    }

    ;['', '2', '3', '4'].forEach(s => {
      layout[`xaxis${s}`] = { title: { text: 'r [m]', font: { color: '#6a8aaa', size: 10 } }, gridcolor: '#1a2a3a', range: [0, 2.0] }
      layout[`yaxis${s}`] = { gridcolor: '#1a2a3a', zerolinecolor: '#1a3050' }
    })

    // Zonas de régimen en panel Reynolds
    layout.shapes.push(
      { type: 'rect', x0: 0, x1: 2, y0: 0, y1: 2300, xref: 'x4', yref: 'y4', fillcolor: 'rgba(68,170,255,0.07)', line: { width: 0 } },
      { type: 'rect', x0: 0, x1: 2, y0: 2300, y1: 4000, xref: 'x4', yref: 'y4', fillcolor: 'rgba(255,200,0,0.07)', line: { width: 0 } },
      { type: 'rect', x0: 0, x1: 2, y0: 4000, y1: Math.max(...re_sorted) * 1.1, xref: 'x4', yref: 'y4', fillcolor: 'rgba(255,50,50,0.07)', line: { width: 0 } }
    )

    return (
      <Plot
        data={traces}
        layout={layout}
        config={PLOTLY_CONFIG}
        style={{ width: '100%', height: '520px' }}
        useResizeHandler
      />
    )
  }

  // ── Tab: Vista 3D ─────────────────────────────────────────────
  if (activeTab === '3d') {
    if (!plot3D) return null

    const layout3D = {
      ...BASE_LAYOUT,
      height: 520,
      margin: { l: 0, r: 0, t: 30, b: 0 },
      scene: {
        xaxis: { title: 'X [m]', gridcolor: '#1a2a3a', backgroundcolor: 'rgba(6,13,24,0)', zerolinecolor: '#1a3050' },
        yaxis: { title: 'Y [m]', gridcolor: '#1a2a3a', backgroundcolor: 'rgba(6,13,24,0)', zerolinecolor: '#1a3050' },
        zaxis: { title: 'Z [m]', gridcolor: '#1a2a3a', backgroundcolor: 'rgba(6,13,24,0)', zerolinecolor: '#1a3050' },
        bgcolor: 'rgba(11,21,40,0.95)',
        camera: { eye: { x: 2.0, y: 1.5, z: 1.0 }, up: { x: 0, y: 0, z: 1 } },
        aspectmode: 'manual',
        aspectratio: { x: 1, y: 1, z: 2 }
      },
      showlegend: false
    }

    return (
      <Plot
        data={plot3D}
        layout={layout3D}
        config={{ ...PLOTLY_CONFIG, modeBarButtonsToRemove: [] }}
        style={{ width: '100%', height: '520px' }}
        useResizeHandler
      />
    )
  }

  return null
}
