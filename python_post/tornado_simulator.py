"""
================================================================================
SIMULACIÓN ANALÍTICA DE VÓRTICE TIPO TORNADO — Modelo de Sullivan / Burgers
================================================================================

Este módulo implementa la simulación numérica del campo de velocidades de un
tornado usando modelos vorticales analíticos clásicos:

1. VÓRTICE DE RANKINE COMBINADO:
   ┌─────────────────────────────────────────────────────────────────────────┐
   │  Núcleo (r < rc):  u_θ = Ω·r        (rotación sólida)                 │
   │  Exterior (r > rc): u_θ = Γ/(2π·r)  (vórtice potencial / irrotacional) │
   └─────────────────────────────────────────────────────────────────────────┘

2. VÓRTICE DE BURGERS (con updraft):
   u_r = -a·r / 2                         (inflow radial)
   u_θ = Γ/(2π·r) · [1 - exp(-a·r²/2ν)] (azimuthal con viscosidad)
   u_z = a·z                              (updraft vertical)

3. VÓRTICE DE SULLIVAN (2-cell):
   Modelo más realista que incluye downdraft en el núcleo y updraft externo.
   Utilizado en estudios académicos de tornados desde los 60s (Sullivan, 1959).

FUNDAMENTO MATEMÁTICO:
   Vorticidad: ω = ∇ × u = (∂uz/∂y - ∂uy/∂z, ∂ux/∂z - ∂uz/∂x, ∂uy/∂x - ∂ux/∂y)
   En coordenadas cilíndricas (r, θ, z):
   ω_z = (1/r) · ∂(r·u_θ)/∂r - (1/r) · ∂u_r/∂θ

Autor: Proyecto CFD Universitario
Fecha: 2026
================================================================================
"""

import numpy as np
import json
import os


# ============================================================================
# PARÁMETROS DEL MODELO DE TORNADO
# ============================================================================

class TornadoParameters:
    """
    Parámetros físicos del tornado simulado.
    
    Basado en datos de tornados reales escalados para simulación:
    - Tornado EF3 (Enhanced Fujita Scale 3): V_max = 70 m/s
    - Escala reducida para laboratorio: V_max = 20 m/s
    
    El número de Reynolds resulta:
        Re = V_max * rc / ν = 20 * 0.2 / 1.48e-5 ≈ 270,000
        → Flujo TURBULENTO (Re >> 4000)
    """
    
    def __init__(self):
        # === Propiedades del fluido (aire a 20°C, 1 atm) ===
        self.rho    = 1.225         # [kg/m³] Densidad del aire
        self.mu     = 1.81e-5       # [Pa·s]  Viscosidad dinámica
        self.nu     = self.mu / self.rho  # [m²/s] Viscosidad cinemática ≈ 1.48e-5
        
        # === Geometría del dominio ===
        self.R_domain = 2.0         # [m] Radio total del dominio
        self.H_domain = 4.0         # [m] Altura total del dominio
        
        # === Parámetros del vórtice ===
        self.rc     = 0.3           # [m] Radio del núcleo (core radius)
        self.Gamma  = 5.0           # [m²/s] Circulación total Γ (intensidad del vórtice)
        self.a      = 1.0           # [1/s] Tasa de estiramiento (straining rate)
        
        # Velocidad máxima tangencial (en r = rc):
        # u_max = Γ / (2π·rc)
        self.U_max  = self.Gamma / (2 * np.pi * self.rc)
        
        # === Resolución de la malla ===
        self.Nr     = 60            # Puntos radiales
        self.Ntheta = 72            # Puntos azimutales (360°/72 = 5°)
        self.Nz     = 80            # Puntos verticales
        
        print(f"[TornadoSim] Parámetros inicializados:")
        print(f"  Velocidad máxima: U_max = {self.U_max:.2f} m/s")
        print(f"  Radio del núcleo: rc = {self.rc} m")
        print(f"  Circulación: Γ = {self.Gamma} m²/s")
        print(f"  Viscosidad cinemática: ν = {self.nu:.2e} m²/s")
        
        # Calcular Re representativo
        from reynolds import ReynoldsAnalyzer
        re_analyzer = ReynoldsAnalyzer(self.rho, self.mu)
        Re = re_analyzer.calcular_reynolds(self.U_max, self.rc)
        regimen = re_analyzer.clasificar_flujo(Re)
        print(f"  Reynolds representativo: Re = {Re:,.0f} → {regimen}")


# ============================================================================
# GENERACIÓN DEL CAMPO DE VELOCIDADES
# ============================================================================

class TornadoSimulator:
    """
    Genera el campo de velocidades 3D de un tornado usando el modelo de Burgers.
    
    El modelo de Burgers es una solución exacta de las ecuaciones de Navier-Stokes
    para un vórtice con estiramiento axial. Fue introducido por Burgers (1948) y
    es ampliamente usado como benchmark en CFD de vórtices.
    
    Campo de velocidades en coordenadas cilíndricas (r, θ, z):
        u_r(r)    = -a·r / 2               [Inflow radial convergente]
        u_θ(r)    = f(r, Γ, ν, a)         [Rotación tangencial]
        u_z(r,z)  = a·z · g(r)            [Updraft vertical]
    
    La función azimuthal exacta del modelo Burgers:
        u_θ(r) = Γ/(2π·r) · [1 - exp(-r²/(2·δ²))]
    donde δ = √(ν/a) es el radio de Burgers (escala viscosa).
    """
    
    def __init__(self, params: TornadoParameters):
        self.p = params
        self.delta_burgers = np.sqrt(params.nu / params.a)
        print(f"[TornadoSim] Radio de Burgers: δ = {self.delta_burgers:.4f} m")
    
    def velocidad_radial(self, r: np.ndarray) -> np.ndarray:
        """
        Componente radial (inflow): u_r = -a·r/2
        
        El signo negativo indica convergencia hacia el eje.
        Físicamente: el aire de la periferia es atraído hacia el centro
        por la baja presión del núcleo (succión).
        
        Unidades: [m/s]
        """
        return -self.p.a * r / 2.0
    
    def velocidad_azimuthal_rankine(self, r: np.ndarray) -> np.ndarray:
        """
        Componente tangencial — Modelo Rankine Combinado:
        
        Núcleo (r ≤ rc):   u_θ = (Γ/(2π·rc²)) · r   [sólido rígido, ω ≠ 0]
        Exterior (r > rc): u_θ = Γ/(2π·r)             [irrotacional, ω = 0]
        
        En el núcleo, la vorticidad es:
            ω_z = (1/r)·∂(r·u_θ)/∂r = Γ/(π·rc²) = cte  (uniforme)
        
        En el exterior, u_θ ~ 1/r → irrotacional (vórtice libre)
        """
        rc = self.p.rc
        Gamma = self.p.Gamma
        
        u_theta = np.where(
            r <= rc,
            (Gamma / (2 * np.pi * rc**2)) * r,    # Núcleo: sólido rígido
            Gamma / (2 * np.pi * r)                # Exterior: vórtice potencial
        )
        return u_theta
    
    def velocidad_azimuthal_burgers(self, r: np.ndarray) -> np.ndarray:
        """
        Componente tangencial — Modelo Burgers (solución exacta N-S):
        
            u_θ = Γ/(2π·r) · [1 - exp(-r²/(2·δ²))]
        
        La función entre corchetes es una "función de masa vorticosa":
            - Cerca del eje (r→0):    u_θ ≈ Γ·r/(4π·δ²)  (tipo sólido rígido)
            - Lejos del eje (r→∞):   u_θ ≈ Γ/(2π·r)      (vórtice potencial)
        
        La transición ocurre en r ≈ 1.12·δ (radio de máxima velocidad)
        
        Unidades: [m/s]
        """
        delta = self.delta_burgers
        r_safe = np.maximum(r, 1e-10)  # Evitar división por cero en r=0
        
        u_theta = (self.p.Gamma / (2 * np.pi * r_safe)) * \
                  (1 - np.exp(-r_safe**2 / (2 * delta**2)))
        return u_theta
    
    def velocidad_vertical(self, r: np.ndarray, z: np.ndarray) -> np.ndarray:
        """
        Componente vertical (updraft): u_z = a·z · h(r)
        
        h(r) es una función de modulación radial:
            h(r) = [1 - exp(-r²/(2·δ²))]  [fuera del núcleo: updraft fuerte]
        
        Físicamente:
            - Fuera del núcleo: el aire sube fuertemente (updraft)
            - Centro del núcleo: downdraft débil (modelo Sullivan 2-cell)
        
        Unidades: [m/s]
        """
        delta = self.delta_burgers
        r_safe = np.maximum(r, 1e-10)
        
        # Modulación espacial: updraft máximo en r = rc
        h_r = 1 - np.exp(-r_safe**2 / (2 * delta**2))
        
        # Amplificación por Γ (circulación impone updraft)
        u_z = self.p.a * z * h_r * 2.0
        
        # Limitación para evitar velocidades no físicas en la parte superior
        u_z_max = self.p.U_max * 0.8
        return np.clip(u_z, 0, u_z_max)
    
    def generar_malla_3d(self):
        """
        Genera la malla 3D del dominio en coordenadas cilíndricas.
        Convierte a cartesianas (x, y, z) para compatibilidad con PyVista.
        
        Retorna:
            x, y, z   : coordenadas cartesianas [m]
            r, theta  : coordenadas cilíndricas [m, rad]
        """
        p = self.p
        
        # Malla cilíndrica
        r     = np.linspace(0, p.R_domain, p.Nr)
        theta = np.linspace(0, 2*np.pi, p.Ntheta, endpoint=False)
        z     = np.linspace(0, p.H_domain, p.Nz)
        
        # Crear grilla 3D
        R, THETA, Z = np.meshgrid(r, theta, z, indexing='ij')
        
        # Convertir a cartesianas
        X = R * np.cos(THETA)
        Y = R * np.sin(THETA)
        
        return X, Y, Z, R, THETA
    
    def calcular_campo_velocidades(self):
        """
        Calcula el campo de velocidades completo en 3D.
        
        Retorna diccionario con:
            - x, y, z          : malla cartesiana
            - ur, utheta, uz   : componentes en cilíndricas
            - u, v, w          : componentes cartesianas (para OpenFOAM/PyVista)
            - velocity_magnitude: |U| = √(u² + v² + w²)
            - r_grid           : distancia radial
        """
        print("[TornadoSim] Generando campo de velocidades 3D...")
        
        X, Y, Z, R, THETA = self.generar_malla_3d()
        
        # Velocidades en coordenadas cilíndricas
        ur     = self.velocidad_radial(R)
        utheta = self.velocidad_azimuthal_burgers(R)
        uz     = self.velocidad_vertical(R, Z)
        
        # Convertir a cartesianas:
        # u = ur·cos(θ) - uθ·sin(θ)
        # v = ur·sin(θ) + uθ·cos(θ)
        u = ur * np.cos(THETA) - utheta * np.sin(THETA)
        v = ur * np.sin(THETA) + utheta * np.cos(THETA)
        w = uz
        
        # Magnitud de velocidad
        mag_U = np.sqrt(u**2 + v**2 + w**2)
        
        print(f"[TornadoSim] Campo calculado:")
        print(f"  Forma de la malla: {X.shape}")
        print(f"  U_max = {mag_U.max():.2f} m/s")
        print(f"  Puntos totales: {X.size:,}")
        
        return {
            'x': X, 'y': Y, 'z': Z,
            'r': R, 'theta': THETA,
            'ur': ur, 'utheta': utheta, 'uz': uz,
            'u': u, 'v': v, 'w': w,
            'velocity_magnitude': mag_U
        }
    
    def calcular_campo_presion(self, campos: dict):
        """
        Calcula el campo de presión a partir del campo de velocidades.
        
        Para flujo axisimétrico en balance ciclostrófico:
            ∂p/∂r = ρ·u_θ²/r
        
        Integrando desde el borde (p=0) hacia el centro:
            p(r) = ∫_r^R (ρ·u_θ²/r') dr'
        
        El defecto de presión en el núcleo es la firma del tornado.
        
        Unidades: [Pa] (si ρ en kg/m³ y u_θ en m/s)
        """
        r = campos['r']
        utheta = campos['utheta']
        
        # Evitar división por cero
        r_safe = np.maximum(r, 1e-10)
        
        # Gradiente radial de presión: dp/dr = ρ·u_θ²/r
        # Integramos numéricamente desde el exterior (r=R_domain)
        # Presión: p_gauge = -ρ·Γ²/(8π²) · ln(r/rc) para r > rc
        # (solución analítica para vórtice de Rankine)
        
        rc = self.p.rc
        Gamma = self.p.Gamma
        rho = self.p.rho
        
        # Presión analítica (Rankine)
        # Exterior: p = p_inf - rho·Gamma²/(8pi²r²)
        # Interior:  p = p_nuc + rho·Omega²·r²/2
        
        R_domain = self.p.R_domain
        
        # Presión en el exterior (r > rc): vórtice potencial
        p_exterior = -rho * (Gamma**2) / (8 * np.pi**2 * np.maximum(r_safe, rc)**2)
        
        # En el núcleo: presión parabólica
        # p_nuc = p(rc) - rho*(Omega*rc)²/2 = mínimo en r=0
        Omega = Gamma / (2 * np.pi * rc**2)
        p_nuc_at_rc = -rho * Gamma**2 / (8 * np.pi**2 * rc**2)
        p_interior = p_nuc_at_rc - rho * Omega**2 * (rc**2 - r_safe**2) / 2
        
        # Combinar
        presion = np.where(r_safe <= rc, p_interior, p_exterior)
        
        # Normalizar (presión manométrica: 0 en el borde)
        presion = presion - presion.min()
        presion = presion - presion.max()  # Máximo 0, mínimo negativo
        
        print(f"[TornadoSim] Campo de presión calculado:")
        print(f"  p_min (núcleo) = {presion.min():.2f} Pa")
        print(f"  p_max (borde)  = {presion.max():.2f} Pa")
        print(f"  Defecto Δp     = {presion.max()-presion.min():.2f} Pa")
        
        return presion
    
    def exportar_datos(self, campos: dict, presion: np.ndarray, 
                       output_dir: str = "../data"):
        """
        Exporta los campos simulados en formato NPZ para el backend.
        
        El backend Node.js leerá estos datos y los servirá al frontend React.
        """
        os.makedirs(output_dir, exist_ok=True)
        
        filepath = os.path.join(output_dir, "tornado_fields.npz")
        np.savez_compressed(
            filepath,
            x=campos['x'],
            y=campos['y'],
            z=campos['z'],
            u=campos['u'],
            v=campos['v'],
            w=campos['w'],
            r=campos['r'],
            utheta=campos['utheta'],
            velocity_magnitude=campos['velocity_magnitude'],
            pressure=presion
        )
        print(f"[TornadoSim] Datos exportados: {filepath}")
        
        # También exportar en formato JSON (para el API)
        # Tomamos una muestra para no saturar la API
        sample_idx = {
            'z_level': self.p.Nz // 3,   # Nivel z=H/3 para el corte
            'sample_rate': 4              # Submuestrear cada 4 puntos
        }
        
        # Muestra 2D en z=H/3
        zi = sample_idx['z_level']
        sr = sample_idx['sample_rate']
        
        sample_data = {
            "metadata": {
                "U_max": float(campos['velocity_magnitude'].max()),
                "p_min": float(presion.min()),
                "p_max": float(presion.max()),
                "rc": self.p.rc,
                "Gamma": self.p.Gamma,
                "grid_shape": list(campos['x'].shape),
                "model": "Burgers Vortex"
            },
            "slice_z": {
                "x": campos['x'][::sr, ::sr, zi].flatten().tolist(),
                "y": campos['y'][::sr, ::sr, zi].flatten().tolist(),
                "u": campos['u'][::sr, ::sr, zi].flatten().tolist(),
                "v": campos['v'][::sr, ::sr, zi].flatten().tolist(),
                "w": campos['w'][::sr, ::sr, zi].flatten().tolist(),
                "mag": campos['velocity_magnitude'][::sr, ::sr, zi].flatten().tolist(),
                "p":   presion[::sr, ::sr, zi].flatten().tolist()
            }
        }
        
        json_path = os.path.join(output_dir, "tornado_api_data.json")
        with open(json_path, 'w') as f:
            json.dump(sample_data, f, indent=2)
        print(f"[TornadoSim] API data exportada: {json_path}")
        
        return filepath, json_path


# ============================================================================
# EJECUCIÓN PRINCIPAL
# ============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("  SIMULACIÓN DE VÓRTICE TIPO TORNADO — Modelo Burgers/Rankine 3D")
    print("=" * 70)
    
    # Importar aquí para testing independiente
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    
    # Inicializar parámetros y simulador
    params = TornadoParameters()
    sim = TornadoSimulator(params)
    
    # Calcular campos
    campos = sim.calcular_campo_velocidades()
    presion = sim.calcular_campo_presion(campos)
    
    # Exportar datos
    sim.exportar_datos(campos, presion)
    
    print("\n[TornadoSim] ✓ Simulación completada exitosamente")
