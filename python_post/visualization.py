"""
================================================================================
VISUALIZACIÓN 3D AVANZADA — Tornado CFD con PyVista y Plotly
================================================================================

Genera visualizaciones científicas de alta calidad:

1. STREAMLINES (líneas de flujo):
   Trayectorias que son tangentes al vector velocidad en cada punto.
   Muestran la estructura global del vórtice.

2. ISOSUPERFICIES DE VORTICIDAD:
   Superficies donde |ω| = constante.
   Revelan la forma y extensión del núcleo vorticoso.

3. VECTORES DE VELOCIDAD:
   Campo vectorial en plano de corte (2D slice) → corte transversal.

4. MAPA DE PRESIÓN:
   Mostra el core de baja presión (firma del tornado).

5. ANIMACIÓN TEMPORAL:
   Frames de la evolución temporal (usando datos sintéticos con t-param).

Paletas utilizadas:
    - 'inferno'  → baja a alta vorticidad (negro → rojo → amarillo)
    - 'plasma'   → campo de presión
    - 'viridis'  → magnitud de velocidad

NOTA: Si PyVista no está disponible, se usa Plotly como alternativa
      (Plotly funciona en navegador — útil para presentaciones).

Autor: Proyecto CFD Universitario
Fecha: 2026
================================================================================
"""

import numpy as np
import os
import json

try:
    import pyvista as pv
    PYVISTA_AVAILABLE = True
except ImportError:
    PYVISTA_AVAILABLE = False
    print("[Viz] Advertencia: PyVista no disponible. Usando Plotly.")

try:
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    import plotly.express as px
    PLOTLY_AVAILABLE = True
except ImportError:
    PLOTLY_AVAILABLE = False
    print("[Viz] Advertencia: Plotly no disponible.")

try:
    import matplotlib.pyplot as plt
    import matplotlib.cm as cm
    from matplotlib.animation import FuncAnimation, PillowWriter
    import matplotlib.colors as mcolors
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False


# ============================================================================
# VISULIZADOR PRINCIPAL
# ============================================================================

class TornadoVisualizer:
    """
    Genera todas las visualizaciones del tornado CFD.
    
    Soporta tres backends:
        - PyVista:     Renderizado 3D interactivo offline (mejor calidad)
        - Plotly:      HTML interactivo (ideal para presentaciones web)
        - Matplotlib:  Gráficos estáticos + animación GIF (siempre disponible)
    """
    
    def __init__(self, campos: dict, omega: dict, Re_data: dict,
                 presion: np.ndarray, output_dir: str = "../frontend/public/data"):
        """
        Args:
            campos:    Campos de velocidad (x, y, z, u, v, w, etc.)
            omega:    Campos de vorticidad (omega_x, omega_y, omega_z, magnitude)
            Re_data:  Datos de Reynolds (Re_local, clasificacion)
            presion:  Campo de presión
            output_dir: Directorio para guardar visualizaciones
        """
        self.campos   = campos
        self.omega    = omega
        self.Re_data  = Re_data
        self.presion  = presion
        self.out_dir  = output_dir
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Extraer dimensiones
        self.Nr, self.Ntheta, self.Nz = campos['x'].shape
        print(f"[Viz] Inicializado. Malla: {self.Nr}×{self.Ntheta}×{self.Nz}")
    
    # =========================================================================
    # VISUALIZACIÓN CON PLOTLY (para el Frontend React)
    # =========================================================================
    
    def generar_corte_transversal_plotly(self, z_index: int = None) -> str:
        """
        Genera un corte horizontal del tornado (plano z=const).
        
        Muestra:
        - Campo de velocidad tangencial con flechas
        - Mapa de colores de vorticidad
        - Contornos de presión
        
        Returns:
            Path del archivo HTML generado
        """
        if not PLOTLY_AVAILABLE:
            print("[Viz] Plotly no disponible")
            return None
        
        if z_index is None:
            z_index = self.Nz // 3  # Nivel z = H/3
        
        # Submuestrear para visualización fluida
        step = 2
        
        x_slice  = self.campos['x'][::step, ::step, z_index]
        y_slice  = self.campos['y'][::step, ::step, z_index]
        u_slice  = self.campos['u'][::step, ::step, z_index]
        v_slice  = self.campos['v'][::step, ::step, z_index]
        w_slice  = self.campos['w'][::step, ::step, z_index]
        
        # Vorticidad en este corte
        omega_z_slice = self.omega['omega_z'][::step, ::step, z_index]
        omega_mag_slice = self.omega['omega_magnitude'][::step, ::step, z_index]
        p_slice = self.presion[::step, ::step, z_index]
        mag_slice = self.campos['velocity_magnitude'][::step, ::step, z_index]
        
        # Aplanar para plotly
        xf = x_slice.flatten()
        yf = y_slice.flatten()
        uf = u_slice.flatten()
        vf = v_slice.flatten()
        omf = omega_mag_slice.flatten()
        magf = mag_slice.flatten()
        pf = p_slice.flatten()
        
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=[
                "🌪️ Magnitud de Velocidad |U| [m/s]",
                "🔴 Vorticidad |ω| [1/s]",
                "💨 Vectores de Velocidad (Quiver)",
                "🔵 Campo de Presión [Pa]"
            ],
            specs=[[{"type": "scatter"}, {"type": "scatter"}],
                   [{"type": "scatter"}, {"type": "scatter"}]]
        )
        
        # --- Panel 1: Magnitud de velocidad (heatmap-style scatter) ---
        fig.add_trace(go.Scatter(
            x=xf, y=yf,
            mode='markers',
            marker=dict(
                color=magf,
                colorscale='viridis',
                size=4,
                opacity=0.85,
                colorbar=dict(title="|U| m/s", x=0.45)
            ),
            name='|U|',
            hovertemplate="x=%{x:.2f}<br>y=%{y:.2f}<br>|U|=%{marker.color:.2f} m/s"
        ), row=1, col=1)
        
        # --- Panel 2: Vorticidad ω (inferno → máxima rotación en rojo) ---
        fig.add_trace(go.Scatter(
            x=xf, y=yf,
            mode='markers',
            marker=dict(
                color=omf,
                colorscale='inferno',
                size=4,
                opacity=0.9,
                colorbar=dict(title="|ω| 1/s", x=1.02)
            ),
            name='Vorticidad',
            hovertemplate="x=%{x:.2f}<br>y=%{y:.2f}<br>|ω|=%{marker.color:.2f} 1/s"
        ), row=1, col=2)
        
        # --- Panel 3: Campo vectorial (quiver) ---
        # Normalizar vectores para consistencia visual
        mag_norm = np.maximum(magf, 0.01)
        scale = 0.15
        fig.add_trace(go.Scatter(
            x=xf, y=yf,
            mode='markers',
            marker=dict(size=1, color='rgba(100,150,255,0.3)'),
            showlegend=False
        ), row=2, col=1)
        
        # Agregar flechas como anotaciones
        step_arrow = 4
        for i in range(0, len(xf), step_arrow):
            u_n = uf[i] / mag_norm[i] * scale
            v_n = vf[i] / mag_norm[i] * scale
            fig.add_annotation(
                x=xf[i] + u_n, y=yf[i] + v_n,
                ax=xf[i], ay=yf[i],
                xref='x3', yref='y3',
                axref='x3', ayref='y3',
                arrowhead=2, arrowsize=0.8,
                arrowwidth=1,
                arrowcolor=f'rgba(50, {int(100 + magf[i]*8)}, 255, 0.7)',
                showarrow=True
            )
        
        # --- Panel 4: Campo de presión (plasma) ---
        fig.add_trace(go.Scatter(
            x=xf, y=yf,
            mode='markers',
            marker=dict(
                color=pf,
                colorscale='plasma',
                size=4,
                opacity=0.9,
            ),
            name='Presión'
        ), row=2, col=2)
        
        # Layout global
        fig.update_layout(
            title=dict(
                text="<b>🌪️ Simulación CFD — Vórtice Tipo Tornado 3D</b><br>"
                     f"<sup>Corte Horizontal z = {z_index * self.campos['z'][0,0,:].ptp() / self.Nz:.2f} m | "
                     f"Modelo: Burgers Vortex | k-ε RANS</sup>",
                font=dict(size=16, color='white'),
                x=0.5
            ),
            paper_bgcolor='#0a0a1a',
            plot_bgcolor='#0d1117',
            font=dict(color='#c0c0d0', family='Inter, sans-serif', size=11),
            height=780,
            showlegend=False,
        )
        
        # Actualizar ejes
        for i in range(1, 5):
            row = (i-1)//2 + 1
            col = (i-1)%2 + 1
            fig.update_xaxes(
                title="x [m]", gridcolor='#1a2030',
                zerolinecolor='#2a3050', row=row, col=col
            )
            fig.update_yaxes(
                title="y [m]", gridcolor='#1a2030',
                zerolinecolor='#2a3050', row=row, col=col
            )
        
        # Guardar HTML
        html_path = os.path.join(self.out_dir, "tornado_2d_slice.html")
        fig.write_html(html_path)
        print(f"[Viz] Corte transversal guardado: {html_path}")
        
        # Guardar JSON para el API
        json_path = os.path.join(self.out_dir, "slice_data.json")
        slice_dict = {
            "x": xf.tolist(), "y": yf.tolist(),
            "u": uf.tolist(), "v": vf.tolist(),
            "omega": omf.tolist(), "pressure": pf.tolist(),
            "mag": magf.tolist()
        }
        with open(json_path, 'w') as f:
            json.dump(slice_dict, f)
        
        return html_path
    
    def generar_perfil_radial_plotly(self) -> str:
        """
        Genera el perfil radial clásico del tornado:
            - u_θ(r): velocidad tangencial vs radio
            - ω_z(r): vorticidad vs radio
            - p(r):   presión vs radio
        
        Muestra claramente:
            - El núcleo (r < rc): sólido rígido
            - La transición en r = rc: máximo de velocidad
            - El exterior (r > rc): caída 1/r
        """
        if not PLOTLY_AVAILABLE:
            return None
        
        # Extraer perfil radial en z = H/2 y theta = 0
        z_mid = self.Nz // 2
        theta_idx = 0
        
        # Radio y campos
        r_1d = self.campos['r'][:, theta_idx, z_mid]  # radio 1D
        utheta_1d = self.campos['utheta'][:, theta_idx, z_mid]
        mag_1d = self.campos['velocity_magnitude'][:, theta_idx, z_mid]
        p_1d = self.presion[:, theta_idx, z_mid]
        
        # Vorticidad radial
        omega_z_1d = self.omega['omega_z'][:, theta_idx, z_mid]
        
        # Reynolds local
        Re_1d = self.Re_data['Re_local'][:, theta_idx, z_mid]
        
        # --- Figura multi-panel ---
        fig = make_subplots(
            rows=2, cols=2,
            subplot_titles=[
                "Velocidad Tangencial u_θ(r)",
                "Vorticidad Vertical ω_z(r)",
                "Presión p(r) — Núcleo de Baja Presión",
                "Reynolds Local Re(r)"
            ]
        )
        
        rc = 0.3  # Radio del núcleo
        
        # Panel 1: Velocidad tangencial
        fig.add_trace(go.Scatter(
            x=r_1d, y=utheta_1d,
            mode='lines',
            line=dict(color='#00d4ff', width=2.5),
            name='u_θ(r)',
            fill='tozeroy', fillcolor='rgba(0,212,255,0.1)'
        ), row=1, col=1)
        
        # Marcar radio del núcleo
        fig.add_vline(x=rc, line=dict(color='#ff6b35', dash='dash', width=1.5),
                      annotation_text=" rc = 0.3m", row=1, col=1)
        
        # Panel 2: Vorticidad
        fig.add_trace(go.Scatter(
            x=r_1d, y=np.abs(omega_z_1d),
            mode='lines',
            line=dict(color='#ff4444', width=2.5),
            name='|ω_z(r)|',
            fill='tozeroy', fillcolor='rgba(255,68,68,0.1)'
        ), row=1, col=2)
        
        fig.add_vline(x=rc, line=dict(color='#ff6b35', dash='dash', width=1.5),
                      row=1, col=2)
        
        # Panel 3: Presión
        fig.add_trace(go.Scatter(
            x=r_1d, y=p_1d,
            mode='lines',
            line=dict(color='#aa44ff', width=2.5),
            name='p(r)',
            fill='tozeroy', fillcolor='rgba(170,68,255,0.1)'
        ), row=2, col=1)
        
        fig.add_vline(x=rc, line=dict(color='#ff6b35', dash='dash', width=1.5),
                      row=2, col=1)
        
        # Panel 4: Reynolds con zonas coloreadas
        fig.add_trace(go.Scatter(
            x=r_1d, y=Re_1d,
            mode='lines',
            line=dict(color='#44ff88', width=2.5),
            name='Re(r)'
        ), row=2, col=2)
        
        # Zonas de régimen
        fig.add_hrect(y0=0, y1=2300,       fillcolor="rgba(0,100,255,0.1)",
                      line_width=0, row=2, col=2)
        fig.add_hrect(y0=2300, y1=4000,    fillcolor="rgba(255,200,0,0.1)",
                      line_width=0, row=2, col=2)
        fig.add_hrect(y0=4000, y1=Re_1d.max()*1.1,
                      fillcolor="rgba(255,50,50,0.1)", line_width=0, row=2, col=2)
        
        fig.add_hline(y=2300, line=dict(color='#4488ff', dash='dot', width=1),
                      annotation_text="Re=2300 (lam/trans)", row=2, col=2)
        fig.add_hline(y=4000, line=dict(color='#ff4444', dash='dot', width=1),
                      annotation_text="Re=4000 (trans/turb)", row=2, col=2)
        
        fig.update_layout(
            title=dict(
                text="<b>Perfiles Radiales del Tornado — Vórtice de Burgers</b>",
                font=dict(size=15, color='white'), x=0.5
            ),
            paper_bgcolor='#0a0a1a',
            plot_bgcolor='#0d1117',
            font=dict(color='#c0c0d0', family='Inter, sans-serif'),
            height=620, showlegend=False
        )
        
        for r in [1, 2]:
            for c in [1, 2]:
                fig.update_xaxes(title="r [m]", gridcolor='#1a2030',
                                 zerolinecolor='#2a3050', row=r, col=c)
                fig.update_yaxes(gridcolor='#1a2030',
                                 zerolinecolor='#2a3050', row=r, col=c)
        
        html_path = os.path.join(self.out_dir, "tornado_radial_profile.html")
        fig.write_html(html_path)
        print(f"[Viz] Perfil radial guardado: {html_path}")
        return html_path
    
    def generar_visualizacion_3d_plotly(self) -> str:
        """
        Visualización 3D completa del tornado en Plotly:
        
        - Isosuperficie de vorticidad (|ω| = threshold)
        - Streamlines simplificadas
        - Corte XZ del campo de velocidad
        
        Uses volume rendering approach con scatter3d
        """
        if not PLOTLY_AVAILABLE:
            return None
        
        print("[Viz] Generando visualización 3D...")
        
        # Submuestrear agresivamente para 3D interactivo
        step = 4
        x3 = self.campos['x'][::step, ::step, ::step]
        y3 = self.campos['y'][::step, ::step, ::step]
        z3 = self.campos['z'][::step, ::step, ::step]
        om3 = self.omega['omega_magnitude'][::step, ::step, ::step]
        mag3 = self.campos['velocity_magnitude'][::step, ::step, ::step]
        
        # Filtro isosuperficie: solo puntos con alta vorticidad
        threshold = om3.max() * 0.15
        mask = om3 > threshold
        
        xf = x3[mask].flatten()
        yf = y3[mask].flatten()
        zf = z3[mask].flatten()
        omf = om3[mask].flatten()
        magf = mag3[mask].flatten()
        
        fig = go.Figure()
        
        # --- Núcleo del vórtice (isosuperficie de vorticidad alta) ---
        fig.add_trace(go.Scatter3d(
            x=xf, y=yf, z=zf,
            mode='markers',
            marker=dict(
                color=omf,
                colorscale='inferno',
                size=2.5,
                opacity=0.5,
                colorbar=dict(title="|ω| [1/s]", thickness=12, x=1.0)
            ),
            name='Núcleo Vorticoso',
            hovertemplate="x=%{x:.2f}<br>y=%{y:.2f}<br>z=%{z:.2f}<br>|ω|=%{marker.color:.1f}"
        ))
        
        # --- Streamlines simplificadas (líneas de flujo helicoidal) ---
        # Generamos líneas de flujo paramétricas del vórtice de Burgers
        n_lines = 12
        angles = np.linspace(0, 2*np.pi, n_lines, endpoint=False)
        
        for angle in angles:
            r0 = 0.8  # Radio inicial de la línea de flujo
            z_range = np.linspace(0.1, 3.5, 200)
            
            # Ángulo que aumenta con z (hélice del tornado)
            theta_line = angle + 2.5 * z_range  # 2.5 rad/m de vuelta
            
            # Radio que disminuye hacia arriba (tipo embudo)
            r_line = r0 * (1 - 0.2 * z_range / 4.0)
            
            x_line = r_line * np.cos(theta_line)
            y_line = r_line * np.sin(theta_line)
            
            opacity = 0.4
            fig.add_trace(go.Scatter3d(
                x=x_line, y=y_line, z=z_range,
                mode='lines',
                line=dict(
                    color=z_range,
                    colorscale='Blues',
                    width=2,
                ),
                opacity=opacity,
                showlegend=False,
                hoverinfo='skip'
            ))
        
        # --- Plano de corte XZ (vorticidad) ---
        step_p = 3
        theta_cut = 0  # Plano theta=0 (plano XZ)
        x_xz = self.campos['x'][:, theta_cut, ::step_p]
        z_xz = self.campos['z'][:, theta_cut, ::step_p]
        w_xz = self.campos['w'][:, theta_cut, ::step_p]
        om_xz = self.omega['omega_magnitude'][:, theta_cut, ::step_p]
        
        fig.add_trace(go.Surface(
            x=x_xz,
            y=np.zeros_like(x_xz),
            z=z_xz,
            surfacecolor=om_xz,
            colorscale='plasma',
            opacity=0.45,
            showscale=False,
            name='Corte XZ (vorticidad)',
            hoverinfo='skip'
        ))
        
        # Layout 3D
        fig.update_layout(
            title=dict(
                text="<b>🌪️ Tornado CFD — Visualización 3D Interactiva</b><br>"
                     "<sup>Núcleo de vorticidad (isosuperficie) + Streamlines + Corte XZ</sup>",
                font=dict(size=14, color='white'), x=0.5
            ),
            scene=dict(
                xaxis=dict(title="X [m]", backgroundcolor='#0a0a1a',
                           gridcolor='#1a2030', zerolinecolor='#2a3050'),
                yaxis=dict(title="Y [m]", backgroundcolor='#0a0a1a',
                           gridcolor='#1a2030', zerolinecolor='#2a3050'),
                zaxis=dict(title="Z [m]", backgroundcolor='#0a0a1a',
                           gridcolor='#1a2030', zerolinecolor='#2a3050'),
                bgcolor='#050510',
                camera=dict(
                    eye=dict(x=2.2, y=1.5, z=1.2)
                )
            ),
            paper_bgcolor='#0a0a1a',
            font=dict(color='#c0c0d0', family='Inter, sans-serif'),
            height=750,
            showlegend=False
        )
        
        html_path = os.path.join(self.out_dir, "tornado_3d.html")
        fig.write_html(html_path)
        print(f"[Viz] Visualización 3D guardada: {html_path}")
        return html_path
    
    # =========================================================================
    # ANIMACIÓN TEMPORAL — GIF
    # =========================================================================
    
    def generar_animacion_matplotlib(self, n_frames: int = 60) -> str:
        """
        Genera una animación GIF de la evolución temporal del tornado.
        
        Simula la rotación del vórtice variando el parámetro de fase temporal t.
        Cada frame rota el campo de velocidad (precesión del vórtice).
        
        Args:
            n_frames: Número de frames del GIF

        Returns:
            Path del GIF generado
        """
        if not MATPLOTLIB_AVAILABLE:
            print("[Viz] Matplotlib no disponible para animación")
            return None
        
        print(f"[Viz] Generando animación: {n_frames} frames...")
        
        # Preparar datos del corte z
        z_idx = self.Nz // 3
        step = 2
        
        x_s = self.campos['x'][::step, ::step, z_idx]
        y_s = self.campos['y'][::step, ::step, z_idx]
        om_s = self.omega['omega_magnitude'][::step, ::step, z_idx]
        mag_s = self.campos['velocity_magnitude'][::step, ::step, z_idx]
        
        fig_anim, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6),
                                             facecolor='#050512')
        
        for ax in [ax1, ax2]:
            ax.set_facecolor('#080820')
            ax.tick_params(colors='#aabbcc')
            ax.spines['bottom'].set_color('#334466')
            ax.spines['top'].set_color('#334466')
            ax.spines['left'].set_color('#334466')
            ax.spines['right'].set_color('#334466')
        
        # Crear scatter inicial
        sc1 = ax1.scatter(
            x_s.flatten(), y_s.flatten(),
            c=om_s.flatten(), cmap='inferno',
            s=3, alpha=0.8, vmin=0, vmax=om_s.max()
        )
        ax1.set_title('Vorticidad |ω| [1/s]', color='white', fontsize=11, pad=8)
        ax1.set_xlabel('x [m]', color='#aabbcc')
        ax1.set_ylabel('y [m]', color='#aabbcc')
        ax1.set_aspect('equal')
        cb1 = plt.colorbar(sc1, ax=ax1)
        cb1.ax.yaxis.set_tick_params(color='#aabbcc')
        plt.setp(cb1.ax.yaxis.get_ticklabels(), color='#aabbcc')
        
        sc2 = ax2.scatter(
            x_s.flatten(), y_s.flatten(),
            c=mag_s.flatten(), cmap='viridis',
            s=3, alpha=0.8, vmin=0, vmax=mag_s.max()
        )
        ax2.set_title('Velocidad |U| [m/s]', color='white', fontsize=11, pad=8)
        ax2.set_xlabel('x [m]', color='#aabbcc')
        ax2.set_ylabel('y [m]', color='#aabbcc')
        ax2.set_aspect('equal')
        cb2 = plt.colorbar(sc2, ax=ax2)
        cb2.ax.yaxis.set_tick_params(color='#aabbcc')
        plt.setp(cb2.ax.yaxis.get_ticklabels(), color='#aabbcc')
        
        title = fig_anim.suptitle(
            '🌪️ Tornado CFD — Evolución Temporal  t = 0.00 s',
            color='white', fontsize=13, y=1.01
        )
        
        plt.tight_layout()
        
        def update(frame):
            """Actualiza cada frame rotando el campo de velocidades."""
            # Ángulo de rotación: simula la precesión del vórtice
            dt = 0.12  # s por frame
            t = frame * dt
            
            # Rotar coordenadas (el vórtice precesa)
            omega_prec = 0.3  # rad/s de precesión
            angle = omega_prec * t
            
            x_rot = x_s * np.cos(angle) - y_s * np.sin(angle)
            y_rot = x_s * np.sin(angle) + y_s * np.cos(angle)
            
            # Añadir perturbación turbulenta
            noise_scale = 0.03 * np.sin(t * 2.1)
            omega_frame = om_s * (1 + noise_scale * np.random.randn(*om_s.shape) * 0.1)
            omega_frame = np.maximum(omega_frame, 0)
            mag_frame = mag_s * (1 + noise_scale * 0.05)
            
            sc1.set_offsets(np.column_stack([x_rot.flatten(), y_rot.flatten()]))
            sc1.set_array(omega_frame.flatten())
            sc2.set_offsets(np.column_stack([x_rot.flatten(), y_rot.flatten()]))
            sc2.set_array(mag_frame.flatten())
            
            title.set_text(f'🌪️ Tornado CFD — Evolución Temporal  t = {t:.2f} s')
            return sc1, sc2, title
        
        anim = FuncAnimation(fig_anim, update, frames=n_frames, interval=80)
        
        gif_path = os.path.join(self.out_dir, "tornado_animation.gif")
        
        try:
            writer = PillowWriter(fps=12)
            anim.save(gif_path, writer=writer, dpi=100)
            print(f"[Viz] Animación guardada: {gif_path}")
        except Exception as e:
            print(f"[Viz] Error guardando GIF: {e}")
            gif_path = None
        
        plt.close(fig_anim)
        return gif_path
    
    def exportar_datos_frontend(self) -> str:
        """
        Exporta los datos procesados en formato JSON para el frontend React.
        
        El backend Node.js servirá estos datos al componente React TornadoViewer.
        """
        print("[Viz] Exportando datos para el frontend...")
        
        # Extraer datos clave para la visualización 3D en el browser (Three.js)
        step = 5  # Reducir para JSON liviano
        
        z_idx = self.Nz // 3
        
        # Datos para streamlines (100 puntos por línea, 20 líneas)
        n_lines = 20
        angles = np.linspace(0, 2*np.pi, n_lines, endpoint=False)
        streamlines = []
        
        for angle in angles:
            r0 = np.random.uniform(0.5, 1.5)
            z_vals = np.linspace(0.1, 3.8, 80)
            theta_vals = angle + 3.0 * z_vals
            r_vals = r0 * (1 - 0.15 * z_vals / 4.0)
            
            x_line = (r_vals * np.cos(theta_vals)).tolist()
            y_line = (r_vals * np.sin(theta_vals)).tolist()
            z_line = z_vals.tolist()
            
            streamlines.append({'x': x_line, 'y': y_line, 'z': z_line})
        
        # Datos del corte z para heatmap
        x_s = self.campos['x'][::step, ::step, z_idx].flatten()
        y_s = self.campos['y'][::step, ::step, z_idx].flatten()
        om_s = self.omega['omega_magnitude'][::step, ::step, z_idx].flatten()
        mag_s = self.campos['velocity_magnitude'][::step, ::step, z_idx].flatten()
        p_s = self.presion[::step, ::step, z_idx].flatten()
        re_s = self.Re_data['Re_local'][::step, ::step, z_idx].flatten()
        cl_s = self.Re_data['clasificacion'][::step, ::step, z_idx].flatten()
        
        # Estadísticas para el panel de info
        stats = {
            'U_max': float(self.campos['velocity_magnitude'].max()),
            'omega_max': float(self.omega['omega_magnitude'].max()),
            'p_min': float(self.presion.min()),
            'Re_max': float(self.Re_data['Re_local'].max()),
            'Re_medio': float(self.Re_data['Re_local'].mean()),
            'frac_laminar': float(np.mean(self.Re_data['clasificacion'] == 0)),
            'frac_transicion': float(np.mean(self.Re_data['clasificacion'] == 1)),
            'frac_turbulento': float(np.mean(self.Re_data['clasificacion'] == 2)),
        }
        
        export_data = {
            'metadata': {
                'model': 'Burgers Vortex + k-epsilon RANS',
                'solver': 'pimpleFoam (OpenFOAM)',
                'grid': f'{self.Nr}x{self.Ntheta}x{self.Nz}',
                'domain': '4m x 4m x 4m cilíndrico',
                'fluid': 'Aire, ρ=1.225 kg/m³, ν=1.48e-5 m²/s'
            },
            'statistics': stats,
            'streamlines': streamlines,
            'slice': {
                'x': x_s.tolist(),
                'y': y_s.tolist(),
                'omega': om_s.tolist(),
                'velocity': mag_s.tolist(),
                'pressure': p_s.tolist(),
                'reynolds': re_s.tolist(),
                'flow_regime': cl_s.tolist()
            }
        }
        
        json_path = os.path.join(self.out_dir, "cfd_data.json")
        with open(json_path, 'w') as f:
            json.dump(export_data, f, separators=(',', ':'))
        
        print(f"[Viz] Datos frontend exportados: {json_path}")
        return json_path


# ============================================================================
# EJECUCIÓN PRINCIPAL
# ============================================================================

if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    
    from tornado_simulator import TornadoParameters, TornadoSimulator
    from vorticity import VorticityCalculator
    from reynolds import ReynoldsAnalyzer
    
    params = TornadoParameters()
    sim = TornadoSimulator(params)
    campos = sim.calcular_campo_velocidades()
    presion = sim.calcular_campo_presion(campos)
    
    calc = VorticityCalculator(campos, params)
    omega = calc.calcular_vorticidad_3d()
    
    analyzer = ReynoldsAnalyzer(params.rho, params.mu)
    Re_data = analyzer.calcular_reynolds_local(campos, 'radial')
    
    os.makedirs("../frontend/public/data", exist_ok=True)
    viz = TornadoVisualizer(campos, omega, Re_data, presion)
    
    viz.generar_corte_transversal_plotly()
    viz.generar_perfil_radial_plotly()
    viz.generar_visualizacion_3d_plotly()
    viz.generar_animacion_matplotlib(n_frames=48)
    viz.exportar_datos_frontend()
    
    print("\n[Viz] ✓ Todas las visualizaciones generadas")
