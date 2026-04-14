"""
================================================================================
CÁLCULO DE VORTICIDAD — ω = ∇ × u
================================================================================

La vorticidad es el ROTACIONAL del campo de velocidades:

    ω = ∇ × u = |  i       j       k   |
                 | ∂/∂x   ∂/∂y   ∂/∂z |
                 |  u       v       w   |

    ω_x = ∂w/∂y - ∂v/∂z
    ω_y = ∂u/∂z - ∂w/∂x
    ω_z = ∂v/∂x - ∂u/∂y

INTERPRETACIÓN FÍSICA:
    - ω representa la rotación LOCAL del fluido (no la trayectoria circular)
    - Un fluido puede girar en trayectoria circular pero tener ω=0 (vórtice libre)
    - Un fluido puede tener ω≠0 sin moverse en círculos (flujo de Couette)

EN EL TORNADO:
    - Núcleo (r < rc): ω_z = Γ/(π·rc²) = constante (alta vorticidad uniforme)
    - Exterior (r > rc): ω_z = 0 (vórtice potencial, irrotacional)
    - La vorticidad vertical ω_z es la signatura del tornado

RELACIÓN CON LA ENERGÍA:
    - Enstrofía: E_ω = (1/2)∫|ω|² dV  (energía cinética de rotación)
    - En turbulencia, la enstrofía mide la intensidad del cascada energética

Autor: Proyecto CFD Universitario
Fecha: 2026
================================================================================
"""

import numpy as np
from scipy.ndimage import uniform_filter


# ============================================================================
# CALCULADOR DE VORTICIDAD
# ============================================================================

class VorticityCalculator:
    """
    Calcula la vorticidad tridimensional de un campo de velocidades.
    
    Usa diferencias finitas centradas de segundo orden para las derivadas:
        ∂f/∂x ≈ [f(x+Δx) - f(x-Δx)] / (2·Δx)  [O(Δx²)]
    
    Para los bordes, usa diferencias hacia adelante/atrás de 1er orden.
    """
    
    def __init__(self, campos: dict, params=None):
        """
        Args:
            campos: diccionario con 'x', 'y', 'z', 'u', 'v', 'w'
            params: TornadoParameters (opcional, para calcular escala)
        """
        self.campos = campos
        self.params = params
        
        # Extraer geometría
        self.x = campos['x'][:, 0, 0]  # Vector 1D en x
        self.y = campos['y'][0, :, 0]  # Vector 1D en y (asumiendo meshgrid 'ij')
        self.z = campos['z'][0, 0, :]  # Vector 1D en z
        
        # Espaciados de malla
        self.dx = (self.x[-1] - self.x[0]) / (len(self.x) - 1)
        self.dy = (self.y[-1] - self.y[0]) / (len(self.y) - 1)
        self.dz = (self.z[-1] - self.z[0]) / (len(self.z) - 1)
        
        print(f"[Vorticity] Malla: Δx={self.dx:.3f}, Δy={self.dy:.3f}, Δz={self.dz:.3f} m")
    
    def derivada_x(self, field: np.ndarray) -> np.ndarray:
        """
        Derivada ∂φ/∂x con diferencias finitas centradas (2do orden).
        
        Interior: ∂φ/∂x ≈ (φ_{i+1,j,k} - φ_{i-1,j,k}) / (2Δx)
        Bordes:   ∂φ/∂x ≈ (φ_{1,j,k} - φ_{0,j,k}) / Δx  [1er orden]
        """
        return np.gradient(field, self.dx, axis=0)
    
    def derivada_y(self, field: np.ndarray) -> np.ndarray:
        """Derivada ∂φ/∂y"""
        return np.gradient(field, self.dy, axis=1)
    
    def derivada_z(self, field: np.ndarray) -> np.ndarray:
        """Derivada ∂φ/∂z"""
        return np.gradient(field, self.dz, axis=2)
    
    def calcular_vorticidad_3d(self) -> dict:
        """
        Calcula las tres componentes de la vorticidad:
        
            ω = ∇ × u = (ω_x, ω_y, ω_z)
        
            ω_x = ∂w/∂y - ∂v/∂z  [volteo alrededor del eje x]
            ω_y = ∂u/∂z - ∂w/∂x  [volteo alrededor del eje y]
            ω_z = ∂v/∂x - ∂u/∂y  [rotación vertical — CLAVE en tornados]
        
        En un tornado, ω_z es la componente dominante (rotación vertical).
        Las componentes horizontales (ω_x, ω_y) son importantes en los
        flancos y en la región de transición base-núcleo.
        
        Retorna diccionario con:
            'omega_x', 'omega_y', 'omega_z' : componentes [1/s]
            'omega_magnitude'                : |ω| = √(ω_x²+ω_y²+ω_z²)
            'enstrophy'                      : |ω|²/2 (energía de rotación)
        """
        print("[Vorticity] Calculando ω = ∇×u (diferencias finitas centradas)...")
        
        u = self.campos['u']
        v = self.campos['v']
        w = self.campos['w']
        
        # Derivadas parciales (todas necesarias para el rotacional)
        # Primera fila = ω_x
        dw_dy = self.derivada_y(w)
        dv_dz = self.derivada_z(v)
        
        # Segunda fila = ω_y
        du_dz = self.derivada_z(u)
        dw_dx = self.derivada_x(w)
        
        # Tercera fila = ω_z (la más importante en tornados)
        dv_dx = self.derivada_x(v)
        du_dy = self.derivada_y(u)
        
        # Calcular componentes de vorticidad
        omega_x = dw_dy - dv_dz
        omega_y = du_dz - dw_dx
        omega_z = dv_dx - du_dy
        
        # Magnitud de vorticidad: |ω| = √(ω_x² + ω_y² + ω_z²)
        omega_mag = np.sqrt(omega_x**2 + omega_y**2 + omega_z**2)
        
        # Enstrofía: E = |ω|²/2
        # Relacionada con la tasa de disipación en turbulencia: ε = ν*E
        enstrophy = 0.5 * omega_mag**2
        
        print(f"[Vorticity] Vorticidad calculada:")
        print(f"  |ω|_max = {omega_mag.max():.2f} [1/s]")
        print(f"  |ω|_mean = {omega_mag.mean():.4f} [1/s]")
        print(f"  ω_z_max = {omega_z.max():.2f} [1/s]  ← Componente dominante")
        print(f"  Enstrofía máx = {enstrophy.max():.2f} [1/s²]")
        
        return {
            'omega_x': omega_x,
            'omega_y': omega_y,
            'omega_z': omega_z,
            'omega_magnitude': omega_mag,
            'enstrophy': enstrophy
        }
    
    def calcular_vorticidad_analitica(self, r_grid: np.ndarray, rc: float, 
                                       Gamma: float) -> np.ndarray:
        """
        Vorticidad analítica exacta del vórtice de Rankine:
        
            ω_z(r) = { Γ/(π·rc²)  para r ≤ rc   [núcleo, uniforme]
                     { 0           para r > rc   [exterior, irrotacional]
        
        Esta es la solución exacta. Se usa para validar el cálculo numérico.
        Al comparar con calcular_vorticidad_3d(), el error debe ser < 5%.
        """
        omega_analitica = np.where(
            r_grid <= rc,
            Gamma / (np.pi * rc**2),   # Núcleo: vorticidad constante
            0.0                         # Exterior: irrotacional
        )
        
        omega_max = Gamma / (np.pi * rc**2)
        print(f"[Vorticity] Solución analítica Rankine:")
        print(f"  ω_z (núcleo) = {omega_max:.2f} [1/s]")
        print(f"  ω_z (ext.)   = 0.00 [1/s]")
        
        return omega_analitica
    
    def clasificar_regiones_vorticales(self, omega: dict, threshold_low: float = 2.0,
                                        threshold_high: float = 8.0) -> np.ndarray:
        """
        Clasifica el dominio según la intensidad de vorticidad:
        
            |ω| < threshold_low        → Flujo casi irrotacional (periferia)
            threshold_low ≤ |ω| < high → Zona de transición
            |ω| ≥ threshold_high       → Núcleo del vórtice (alta vorticidad)
        
        Retorna mapa de clasificación:
            0 = irrotacional
            1 = transición
            2 = núcleo vorticoso
        """
        mag = omega['omega_magnitude']
        
        mapa = np.zeros(mag.shape, dtype=int)
        mapa[mag >= threshold_low] = 1
        mapa[mag >= threshold_high] = 2
        
        total = mag.size
        n_irrot = np.sum(mapa == 0)
        n_trans = np.sum(mapa == 1)
        n_nucleo = np.sum(mapa == 2)
        
        print(f"\n[Vorticity] Clasificación de regiones vorticales:")
        print(f"  Irrotacional (|ω| < {threshold_low}):  {n_irrot/total*100:.1f}% del dominio")
        print(f"  Transición   ({threshold_low} ≤ |ω| < {threshold_high}): {n_trans/total*100:.1f}% del dominio")
        print(f"  Núcleo       (|ω| ≥ {threshold_high}): {n_nucleo/total*100:.1f}% del dominio")
        
        return mapa
    
    def calcular_eje_del_vortice(self, omega_z_field: np.ndarray) -> dict:
        """
        Identifica el eje del vórtice como la línea de máxima vorticidad.
        
        En un tornado ideal, el eje es la línea recta r=0.
        En simulaciones reales, el eje puede precesar o deformarse.
        
        Retorna posición del centro del vórtice para cada nivel z.
        """
        Nr, Ntheta, Nz = omega_z_field.shape
        x_grid = self.campos['x']
        y_grid = self.campos['y']
        
        eje_x = []
        eje_y = []
        
        for k in range(Nz):
            # Encontrar el índice de máxima vorticidad en este plano z
            slice_z = np.abs(omega_z_field[:, :, k])
            idx = np.unravel_index(slice_z.argmax(), slice_z.shape)
            eje_x.append(float(x_grid[idx[0], idx[1], k]))
            eje_y.append(float(y_grid[idx[0], idx[1], k]))
        
        z_vals = self.campos['z'][0, 0, :]
        
        return {
            'z': z_vals.tolist() if hasattr(z_vals, 'tolist') else list(z_vals),
            'x_center': eje_x,
            'y_center': eje_y
        }


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
    
    calc = VorticityCalculator(campos, params)
    omega = calc.calcular_vorticidad_3d()
    
    # Clasificar regiones
    mapa = calc.clasificar_regiones_vorticales(omega)
    
    print("\n[Vorticity] ✓ Cálculo de vorticidad completado")
