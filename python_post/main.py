"""
================================================================================
ORQUESTADOR PRINCIPAL — Pipeline CFD Completo del Tornado
================================================================================

Pasos del pipeline:
    1. Inicializar parámetros físicos del tornado
    2. Generar campo de velocidades (modelo Burgers/Rankine)
    3. Calcular campo de presión (balance ciclostrófico)
    4. Calcular vorticidad: ω = ∇ × u
    5. Analizar número de Reynolds y clasificar flujo
    6. Generar visualizaciones (Plotly + Matplotlib GIF)
    7. Exportar datos para el frontend React

Uso:
    python main.py              → Pipeline completo
    python main.py --viz-only  → Solo visualización (carga datos previos)
    python main.py --export    → Solo exportar JSON para API

Autor: Proyecto CFD Universitario
Fecha: 2026
================================================================================
"""

import sys
import os
import time
import argparse
import json

# Agregar directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def imprimir_banner():
    """Imprime el banner de inicio del programa."""
    banner = """
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║   🌪️   SIMULACIÓN CFD — VÓRTICE TIPO TORNADO 3D                         ║
║                                                                          ║
║   Modelo:   Burgers Vortex + Rankine Combinado                          ║
║   Solver:   pimpleFoam (OpenFOAM) + Python Post-procesamiento           ║
║   Turbulencia: k-ε RANS (Launder-Spalding 1974)                        ║
║                                                                          ║
║   Ecuaciones:                                                            ║
║     ∂u/∂t + (u·∇)u = -∇p/ρ + ν∇²u   [Navier-Stokes]                  ║
║     ∇·u = 0                           [Continuidad]                     ║
║     ω = ∇ × u                         [Vorticidad]                      ║
║     Re = U·L/ν                        [Reynolds]                        ║
║                                                                          ║
║   Universidad — Mecánica de Fluidos Computacional                       ║
╚══════════════════════════════════════════════════════════════════════════╝
"""
    print(banner)


def imprimir_separador(titulo: str):
    """Imprime un separador con título."""
    width = 70
    print(f"\n{'='*width}")
    print(f"  {titulo}")
    print(f"{'='*width}")


def ejecutar_pipeline_completo():
    """
    Ejecuta el pipeline completo de simulación CFD.
    
    Este es el orquestador principal que coordina todos los módulos:
        tornado_simulator → vorticity → reynolds → visualization
    """
    
    imprimir_banner()
    t_inicio = time.time()
    
    # =========================================================================
    # PASO 1: PARÁMETROS Y SIMULACIÓN
    # =========================================================================
    imprimir_separador("PASO 1: Inicialización del modelo físico")
    
    from tornado_simulator import TornadoParameters, TornadoSimulator
    
    params = TornadoParameters()
    
    # Imprimir tabla de parámetros físicos
    print("\n  📊 Parámetros del dominio:")
    print(f"     Fluido:           Aire (ρ={params.rho} kg/m³, ν={params.nu:.2e} m²/s)")
    print(f"     Dominio:          Cilindro R={params.R_domain}m, H={params.H_domain}m")
    print(f"     Núcleo rc:        {params.rc} m")
    print(f"     Circulación Γ:    {params.Gamma} m²/s")
    print(f"     Velocidad máx:    {params.U_max:.2f} m/s")
    print(f"     Malla:            {params.Nr}×{params.Ntheta}×{params.Nz} = "
          f"{params.Nr*params.Ntheta*params.Nz:,} celdas")
    
    # =========================================================================
    # PASO 2: CAMPO DE VELOCIDADES
    # =========================================================================
    imprimir_separador("PASO 2: Cálculo del campo de velocidades 3D")
    
    print("\n  ℹ️  Modelo: Vórtice de Burgers (solución exacta de Navier-Stokes)")
    print("     u_r = -a·r/2         [Inflow radial convergente]")
    print("     u_θ = Γ/(2πr)·f(r)  [Rotación tangencial]")
    print("     u_z = a·z·g(r)       [Updraft vertical]")
    print()
    
    sim = TornadoSimulator(params)
    t0 = time.time()
    campos = sim.calcular_campo_velocidades()
    print(f"  ⏱️  Tiempo: {time.time()-t0:.2f}s")
    
    # =========================================================================
    # PASO 3: CAMPO DE PRESIÓN
    # =========================================================================
    imprimir_separador("PASO 3: Cálculo del campo de presión")
    
    print("\n  ℹ️  Balance ciclostrófico: dp/dr = ρ·u_θ²/r")
    print("     La baja presión en el núcleo es la firma característica")
    print("     del tornado. Tornados EF5: Δp ≈ 100 hPa")
    print()
    
    t0 = time.time()
    presion = sim.calcular_campo_presion(campos)
    print(f"  ⏱️  Tiempo: {time.time()-t0:.2f}s")
    
    # =========================================================================
    # PASO 4: VORTICIDAD
    # =========================================================================
    imprimir_separador("PASO 4: Cálculo de vorticidad ω = ∇×u")
    
    print("\n  ℹ️  Vorticidad = Rotacional del campo de velocidades")
    print("     ω_x = ∂w/∂y - ∂v/∂z   [volteo eje x]")
    print("     ω_y = ∂u/∂z - ∂w/∂x   [volteo eje y]")
    print("     ω_z = ∂v/∂x - ∂u/∂y   [rotación vertical — dominante]")
    print()
    
    from vorticity import VorticityCalculator
    
    t0 = time.time()
    calc = VorticityCalculator(campos, params)
    omega = calc.calcular_vorticidad_3d()
    mapa_vortical = calc.clasificar_regiones_vorticales(omega)
    print(f"  ⏱️  Tiempo: {time.time()-t0:.2f}s")
    
    # =========================================================================
    # PASO 5: NÚMERO DE REYNOLDS
    # =========================================================================
    imprimir_separador("PASO 5: Análisis del Número de Reynolds")
    
    print("\n  ℹ️  Re = U·L/ν  = Fuerzas inerciales / Fuerzas viscosas")
    print("     Re < 2300              → Flujo LAMINAR")
    print("     2300 ≤ Re < 4000       → TRANSICIÓN")
    print("     Re ≥ 4000              → TURBULENTO")
    print()
    
    from reynolds import ReynoldsAnalyzer
    
    t0 = time.time()
    analyzer = ReynoldsAnalyzer(params.rho, params.mu)
    
    # Reynolds global (referencia)
    resultado_global = analyzer.calcular_reynolds_global(
        params.U_max, params.rc, "Núcleo del Tornado (rc, U_max)"
    )
    
    # Re en el borde del dominio
    analyzer.calcular_reynolds_global(
        campos['velocity_magnitude'].max() * 0.3, params.R_domain,
        "Borde del dominio (R, 30% U_max)"
    )
    
    # Reynolds local en todo el dominio
    Re_data = analyzer.calcular_reynolds_local(campos, 'radial')
    
    # Escalas de Kolmogorov
    escalas = analyzer.calcular_escalas_kolmogorov(
        resultado_global['Re'], params.rc
    )
    
    # Reynolds turbulento (modelo k-ε)
    analyzer.calcular_reynolds_turbulento(k=1.5, epsilon=0.45)
    
    print(f"\n  ⏱️  Tiempo: {time.time()-t0:.2f}s")
    
    # =========================================================================
    # PASO 6: EXPORTACIÓN DE DATOS
    # =========================================================================
    imprimir_separador("PASO 6: Exportación de datos para API")
    
    # Crear directorio de datos del frontend
    data_dir = os.path.join(os.path.dirname(__file__), "../frontend/public/data")
    os.makedirs(data_dir, exist_ok=True)
    
    t0 = time.time()
    sim.exportar_datos(campos, presion, output_dir=os.path.join(
        os.path.dirname(__file__), "../data"
    ))
    print(f"  ⏱️  Tiempo: {time.time()-t0:.2f}s")
    
    # =========================================================================
    # PASO 7: VISUALIZACIONES
    # =========================================================================
    imprimir_separador("PASO 7: Generación de visualizaciones 3D")
    
    from visualization import TornadoVisualizer
    
    viz = TornadoVisualizer(
        campos, omega, Re_data, presion,
        output_dir=data_dir
    )
    
    print("\n  [7a] Corte transversal 2D (Plotly)...")
    t0 = time.time()
    viz.generar_corte_transversal_plotly()
    print(f"       ⏱️  {time.time()-t0:.2f}s")
    
    print("\n  [7b] Perfiles radiales (Plotly)...")
    t0 = time.time()
    viz.generar_perfil_radial_plotly()
    print(f"       ⏱️  {time.time()-t0:.2f}s")
    
    print("\n  [7c] Visualización 3D interactiva (Plotly)...")
    t0 = time.time()
    viz.generar_visualizacion_3d_plotly()
    print(f"       ⏱️  {time.time()-t0:.2f}s")
    
    print("\n  [7d] Animación temporal (Matplotlib GIF)...")
    t0 = time.time()
    gif_path = viz.generar_animacion_matplotlib(n_frames=60)
    print(f"       ⏱️  {time.time()-t0:.2f}s")
    
    print("\n  [7e] Exportando datos para el frontend React...")
    t0 = time.time()
    json_path = viz.exportar_datos_frontend()
    print(f"       ⏱️  {time.time()-t0:.2f}s")
    
    # =========================================================================
    # RESUMEN FINAL
    # =========================================================================
    t_total = time.time() - t_inicio
    
    imprimir_separador("✅ PIPELINE COMPLETADO")
    print(f"""
  Tiempo total de ejecución: {t_total:.1f}s
  
  📁 Archivos generados:
     ../data/tornado_fields.npz          — Campos 3D completos
     ../data/tornado_api_data.json       — Datos para API
     ../frontend/public/data/cfd_data.json       — Frontend React
     ../frontend/public/data/tornado_2d_slice.html
     ../frontend/public/data/tornado_radial_profile.html
     ../frontend/public/data/tornado_3d.html
     ../frontend/public/data/tornado_animation.gif
  
  🚀 Para iniciar la aplicación web:
     cd ../backend && npm run dev
     cd ../frontend && npm run dev
  
  📊 Resultados clave:
     U_máx   = {campos['velocity_magnitude'].max():.2f} m/s
     |ω|_máx = {omega['omega_magnitude'].max():.2f} 1/s
     Re_máx  = {Re_data['estadisticas']['Re_max']:,.0f}
     Régimen = TURBULENTO ({Re_data['estadisticas']['frac_turbulento']*100:.1f}% del dominio)
  """)
    
    return {
        'campos': campos,
        'omega': omega,
        'Re_data': Re_data,
        'presion': presion,
        'escalas_kolmogorov': escalas
    }


# ============================================================================
# PUNTO DE ENTRADA
# ============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Pipeline CFD Tornado 3D",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        '--quick', action='store_true',
        help='Malla reducida (rápido, menos resolución)'
    )
    
    args = parser.parse_args()
    
    try:
        resultados = ejecutar_pipeline_completo()
    except KeyboardInterrupt:
        print("\n[Main] Simulación interrumpida por el usuario.")
        sys.exit(0)
    except Exception as e:
        print(f"\n[Main] ❌ Error en el pipeline: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
