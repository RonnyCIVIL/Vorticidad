"""
================================================================================
ANÁLISIS DEL NÚMERO DE REYNOLDS — Clasificación de Régimen de Flujo
================================================================================

DEFINICIÓN:
    Re = (ρ · U · L) / μ = (U · L) / ν

    Donde:
        ρ  = densidad del fluido [kg/m³]
        U  = velocidad característica [m/s]
        L  = longitud característica [m]
        μ  = viscosidad dinámica [Pa·s]
        ν  = μ/ρ = viscosidad cinemática [m²/s]

INTERPRETACIÓN FÍSICA:
    Re = Fuerzas inerciales / Fuerzas viscosas

    - Re pequeño (< 2000):
        Las fuerzas viscosas dominan → flujo LAMINAR
        Las capas de fluido se mueven en paralelo sin mezclarse
        Solución analítica existe en muchos casos

    - Re intermedio (2000–4000):
        TRANSICIÓN: el flujo es inestable
        Perturbaciones crecen o se amortiguan según condiciones
        Muy sensible a condiciones de frontera

    - Re grande (> 4000):
        Las fuerzas inerciales dominan → flujo TURBULENTO
        Movimiento caótico, mezcla intensa
        Requiere modelos de turbulencia (k-ε, k-ω SST, LES)

PARA TORNADOS REALES:
    Re = 70 [m/s] × 100 [m] / 1.48×10⁻⁵ [m²/s] ≈ 4.7 × 10⁸
    → TURBULENTO EXTREMO (10,000× el umbral de transición)

Autor: Proyecto CFD Universitario
Fecha: 2026
================================================================================
"""

import numpy as np


# ============================================================================
# CLASIFICADOR DE RÉGIMEN DE FLUJO
# ============================================================================

class ReynoldsAnalyzer:
    """
    Calcula el número de Reynolds en cada punto del dominio y
    clasifica el régimen de flujo: Laminar / Transición / Turbulento.
    
    El análisis local de Reynolds permite identificar:
        - Regiones de núcleo turbulento (alta velocidad, alta vorticidad)
        - Flujo exterior más ordenado
        - Capas de transición (shearlayers)
    """
    
    # Umbrales del número de Reynolds
    RE_LAMINAR_MAX     = 2300   # Por debajo: siempre laminar
    RE_TRANSICION_MAX  = 4000   # Entre 2300-4000: transición
    # Por encima de 4000: turbulento
    
    # Colores para visualización (RGB normalizado)
    COLOR_LAMINAR     = [0.1, 0.3, 0.9]    # Azul
    COLOR_TRANSICION  = [0.9, 0.7, 0.1]    # Amarillo
    COLOR_TURBULENTO  = [0.9, 0.1, 0.1]    # Rojo
    
    def __init__(self, rho: float, mu: float):
        """
        Args:
            rho: Densidad del fluido [kg/m³]
            mu:  Viscosidad dinámica [Pa·s]
        """
        self.rho = rho
        self.mu  = mu
        self.nu  = mu / rho  # Viscosidad cinemática [m²/s]
        
        print(f"[Reynolds] Propiedades del fluido:")
        print(f"  ρ = {rho:.3f} kg/m³")
        print(f"  μ = {mu:.3e} Pa·s")
        print(f"  ν = {self.nu:.3e} m²/s")
    
    def calcular_reynolds(self, U: float | np.ndarray, 
                           L: float) -> float | np.ndarray:
        """
        Calcula el número de Reynolds (escalar o campo 3D).

            Re = U · L / ν

        Args:
            U: Velocidad [m/s] — puede ser escalar o array numpy
            L: Longitud característica [m]

        Returns:
            Re: Número de Reynolds correspondiente

        Ejemplos:
            >>> analyzer = ReynoldsAnalyzer(1.225, 1.81e-5)
            >>> analyzer.calcular_reynolds(20.0, 0.3)
            405405.4...
        """
        return (U * L) / self.nu
    
    def clasificar_flujo(self, Re: float | np.ndarray) -> str | np.ndarray:
        """
        Clasifica el régimen del flujo según Re:

            Re < 2300          → 'Laminar'
            2300 ≤ Re < 4000   → 'Transición'
            Re ≥ 4000          → 'Turbulento'

        Args:
            Re: Número de Reynolds (escalar o array)

        Returns:
            String (si escalar) o array de enteros (0/1/2) si numpy
        """
        if isinstance(Re, np.ndarray):
            clasificacion = np.zeros(Re.shape, dtype=int)
            clasificacion[Re >= self.RE_LAMINAR_MAX] = 1
            clasificacion[Re >= self.RE_TRANSICION_MAX] = 2
            return clasificacion
        else:
            # Escalar
            if Re < self.RE_LAMINAR_MAX:
                return "Laminar"
            elif Re < self.RE_TRANSICION_MAX:
                return "Transición"
            else:
                return "Turbulento"
    
    def calcular_reynolds_local(self, campos: dict, 
                                 longitud_local: str = 'radial') -> dict:
        """
        Calcula Re en cada punto del dominio 3D.
        
        La longitud característica LOCAL puede ser:
            - 'radial':    L = r (distancia al eje) — para flujos rotacionales
            - 'fijo':      L = rc (radio del núcleo) — longitud global
            - 'taylor':    L = √(ν/|∂u/∂z|) — escala de Taylor en la capa límite

        Args:
            campos: dic con 'velocity_magnitude', 'r', etc.
            longitud_local: criterio de longitud característica

        Returns:
            dic con campos Re_local, clasificacion, estadisticas
        """
        print(f"\n[Reynolds] Calculando Re local (L={longitud_local})...")
        
        U_mag = campos['velocity_magnitude']
        r     = campos['r']
        
        if longitud_local == 'radial':
            # L = r (longitud = distancia al eje, significativa en rotación)
            # Cuidado: en r=0, Re=0 (singularidad física)
            L_field = np.maximum(r, 1e-4)
        else:
            # L fijo = radio del núcleo (longitud de referencia global)
            L_field = np.ones_like(U_mag) * 0.3  # rc = 0.3 m
        
        # Campo de Reynolds local
        Re_local = self.calcular_reynolds(U_mag, L_field)
        
        # Clasificación por punto
        clasificacion = self.clasificar_flujo(Re_local)
        
        # Estadísticas
        total = Re_local.size
        n_lam  = np.sum(clasificacion == 0)
        n_tran = np.sum(clasificacion == 1)
        n_turb = np.sum(clasificacion == 2)
        
        stats = {
            'Re_max':    float(Re_local.max()),
            'Re_min':    float(Re_local.min()),
            'Re_medio':  float(Re_local.mean()),
            'frac_laminar':    float(n_lam  / total),
            'frac_transicion': float(n_tran / total),
            'frac_turbulento': float(n_turb / total),
            'n_laminar':    int(n_lam),
            'n_transicion': int(n_tran),
            'n_turbulento': int(n_turb),
        }
        
        self._imprimir_estadisticas(stats)
        
        return {
            'Re_local':     Re_local,
            'clasificacion': clasificacion,
            'estadisticas': stats
        }
    
    def calcular_reynolds_global(self, U_ref: float, L_ref: float,
                                  descripcion: str = "") -> dict:
        """
        Calcula el Reynolds global de la simulación con valores de referencia.
        
        Args:
            U_ref: Velocidad de referencia (ej. U_max) [m/s]
            L_ref: Longitud de referencia (ej. radio del núcleo) [m]
            descripcion: Etiqueta descriptiva para el log

        Returns:
            dic con Re, régimen, y análisis dimensional
        """
        Re = self.calcular_reynolds(U_ref, L_ref)
        regimen = self.clasificar_flujo(Re)
        
        print(f"\n[Reynolds] {'='*50}")
        print(f"[Reynolds] Análisis Global: {descripcion}")
        print(f"  U_ref = {U_ref:.2f} m/s")
        print(f"  L_ref = {L_ref:.4f} m")
        print(f"  ν     = {self.nu:.3e} m²/s")
        print(f"  ─────────────────────────────")
        print(f"  Re = U·L/ν = {U_ref:.2f}×{L_ref:.3f}/{self.nu:.3e}")
        print(f"  Re = {Re:.0f}")
        print(f"  Régimen: {regimen.upper()}")
        
        if Re > 4000:
            print(f"  ⚠ Re >> 4000 → Modelado de turbulencia NECESARIO")
            print(f"  → Usar k-ε, k-ω SST, o LES en OpenFOAM")
        
        return {
            'Re': float(Re),
            'regimen': regimen,
            'U_ref': U_ref,
            'L_ref': L_ref,
            'nu': self.nu
        }
    
    def calcular_escalas_kolmogorov(self, Re_global: float, 
                                     L_ref: float) -> dict:
        """
        Calcula las ESCALAS DE KOLMOGOROV — las más pequeñas escalas
        de la turbulencia, donde la energía se disipa en calor.
        
        Teoría de Kolmogorov (1941):
            η = (ν³/ε)^(1/4)    [escala de longitud]
            τ = (ν/ε)^(1/2)     [escala de tiempo]
            u_k = (ν·ε)^(1/4)   [escala de velocidad]
        
        Donde ε = U³/(L·Re)^(3/4) es la tasa de disipación estimada.
        
        La relación η/L ~ Re^(-3/4) muestra que flujos más turbulentos
        requieren mallas más finas para resolver todas las escalas (DNS).
        """
        # Estimación de la tasa de disipación ε
        # ε ~ U³/L en flujo totalmente turbulento
        U_ref = Re_global * self.nu / L_ref
        epsilon_est = U_ref**3 / L_ref
        
        # Escalas de Kolmogorov
        eta   = (self.nu**3 / epsilon_est) ** 0.25   # [m]
        tau_k = (self.nu / epsilon_est) ** 0.5        # [s]
        u_k   = (self.nu * epsilon_est) ** 0.25       # [m/s]
        
        # Relación entre escala integral y Kolmogorov
        ratio_L_eta = L_ref / eta
        
        print(f"\n[Reynolds] Escalas de Kolmogorov (Re = {Re_global:.0f}):")
        print(f"  η = {eta*1000:.3f} mm  [escala de disipación viscosa]")
        print(f"  τ = {tau_k*1000:.3f} ms [escala de tiempo]")
        print(f"  u_k = {u_k:.4f} m/s  [velocidad de Kolmogorov]")
        print(f"  L/η = {ratio_L_eta:.0f}  [separación de escalas]")
        print(f"  → Para DNS: necesitarías ≈{ratio_L_eta**3:.2e} celdas")
        print(f"  → Por eso se usan modelos RANS/LES en lugar de DNS")
        
        return {
            'eta':   eta,
            'tau_k': tau_k,
            'u_k':   u_k,
            'L_eta': ratio_L_eta,
            'epsilon': epsilon_est
        }
    
    def calcular_reynolds_turbulento(self, k: float, epsilon: float) -> float:
        """
        Reynolds turbulento basado en energía cinética turbulenta:
        
            Re_t = k² / (ν·ε)
        
        Donde:
            k: energía cinética turbulenta [m²/s²]
            ε: tasa de disipación [m²/s³]
        
        Re_t → ∞ implica que la turbulencia es completamente desarrollada.
        Re_t es usado en modelos k-ε para calcular la viscosidad turbulenta:
            νt = Cμ · k²/ε   (Cμ = 0.09)
        """
        Re_t = k**2 / (self.nu * epsilon)
        nu_t = 0.09 * k**2 / epsilon  # Viscosidad turbulenta
        
        print(f"[Reynolds] Reynolds turbulento:")
        print(f"  k = {k} m²/s², ε = {epsilon} m²/s³")
        print(f"  Re_t = k²/(ν·ε) = {Re_t:.0f}")
        print(f"  νt = 0.09·k²/ε = {nu_t:.4f} m²/s")
        print(f"  νt/ν = {nu_t/self.nu:.1f}  [magnificación turbulenta]")
        
        return Re_t
    
    def _imprimir_estadisticas(self, stats: dict):
        """Imprime tabla de estadísticas del Reynolds local."""
        print(f"\n[Reynolds] Estadísticas del campo Re local:")
        print(f"  ┌────────────────────────────────────────┐")
        print(f"  │  Re_máx   = {stats['Re_max']:>12,.0f}              │")
        print(f"  │  Re_medio = {stats['Re_medio']:>12,.0f}              │")
        print(f"  │  Re_mín   = {stats['Re_min']:>12,.2f}              │")
        print(f"  ├────────────────────────────────────────┤")
        print(f"  │  LAMINAR       {stats['frac_laminar']*100:>6.1f}% del dominio    │")
        print(f"  │  TRANSICIÓN    {stats['frac_transicion']*100:>6.1f}% del dominio    │")
        print(f"  │  TURBULENTO    {stats['frac_turbulento']*100:>6.1f}% del dominio    │")
        print(f"  └────────────────────────────────────────┘")


# ============================================================================
# EJECUCIÓN PRINCIPAL
# ============================================================================

if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    
    from tornado_simulator import TornadoParameters, TornadoSimulator
    
    params = TornadoParameters()
    sim = TornadoSimulator(params)
    campos = sim.calcular_campo_velocidades()
    
    analyzer = ReynoldsAnalyzer(params.rho, params.mu)
    
    # Reynolds global
    resultado_global = analyzer.calcular_reynolds_global(
        params.U_max, params.rc, "Núcleo del Tornado"
    )
    
    # Reynolds local en todo el dominio
    resultado_local = analyzer.calcular_reynolds_local(campos, 'radial')
    
    # Escalas de Kolmogorov
    escalas = analyzer.calcular_escalas_kolmogorov(
        resultado_global['Re'], params.rc
    )
    
    # Reynolds turbulento (usando valores del modelo k-ε)
    Re_t = analyzer.calcular_reynolds_turbulento(k=1.5, epsilon=0.45)
    
    print("\n[Reynolds] ✓ Análisis completado")
