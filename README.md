# 🌪️ Simulación CFD 3D — Vórtice Tipo Tornado

> **Proyecto académico de alto nivel** — Mecánica de Fluidos Computacional  
> Universidad · Año 2026

Dashboard interactivo de simulación CFD de un tornado usando **OpenFOAM + Python + React**.

---

## 📐 Fundamentos Físicos

### Ecuaciones de Navier-Stokes (Incompresibles)

```
∇·u = 0                                          [Continuidad]
∂u/∂t + (u·∇)u = -∇p/ρ + ν∇²u                 [Momento]
```

| Término | Nombre | Significado físico |
|---------|--------|-------------------|
| `∂u/∂t` | Aceleración local | Variación temporal de velocidad |
| `(u·∇)u` | Convección no-lineal | **Genera vorticidad** — acoplamiento de escalas |
| `-∇p/ρ` | Gradiente de presión | Fuerza de presión — crea núcleo de baja p |
| `ν∇²u` | Difusión viscosa | Disipación de energía como calor |

### Vorticidad
```
ω = ∇ × u     [Rotacional del campo de velocidades, 1/s]
```
- **Núcleo (r < rc):** `ω_z = Γ/(π·rc²)` = constante → zona de alta rotación
- **Exterior (r > rc):** `ω_z = 0` → vórtice potencial irrotacional

### Número de Reynolds
```
Re = U·L / ν = ρ·U·L / μ
```
| Rango Re | Régimen |
|----------|---------|
| Re < 2,300 | 🔵 **Laminar** |
| 2,300 < Re < 4,000 | 🟡 **Transición** |
| Re > 4,000 | 🔴 **Turbulento** |

**En el tornado simulado:** `Re ≈ 270,000` → Turbulento extremo

---

## 🏗️ Estructura del Proyecto

```
Vorticidad Mecanica Fluidos Final/
│
├── openfoam_case/              ← Caso OpenFOAM (pimpleFoam + k-ε)
│   ├── 0/                      ← Condiciones iniciales (t=0)
│   │   ├── U                   ← Velocidad con rotación de tornado
│   │   ├── p                   ← Presión (núcleo de baja presión)
│   │   ├── k                   ← Energía cinética turbulenta
│   │   ├── epsilon             ← Tasa de disipación
│   │   └── nut                 ← Viscosidad turbulenta νt
│   ├── constant/               ← Propiedades físicas
│   │   ├── transportProperties ← ν = 1.48e-5 m²/s (aire)
│   │   └── turbulenceProperties← Modelo k-ε activado
│   ├── system/                 ← Configuración numérica
│   │   ├── blockMeshDict       ← Malla 40×40×60 celdas
│   │   ├── controlDict         ← T=[0,10]s, Co<0.9 adaptativo
│   │   ├── fvSchemes           ← Gauss limitedLinear (2do orden)
│   │   └── fvSolution          ← PIMPLE (nOuter=3, nCorr=2)
│   └── Allrun                  ← Script de ejecución completo
│
├── python_post/                ← Post-procesamiento Python
│   ├── main.py                 ← Orquestador del pipeline completo
│   ├── tornado_simulator.py   ← Modelo Burgers/Rankine analítico
│   ├── vorticity.py            ← Cálculo ω = ∇×u (diferencias finitas)
│   ├── reynolds.py             ← Re local + Kolmogorov + clasificación
│   ├── visualization.py        ← Plotly 3D + Matplotlib GIF
│   └── requirements.txt        ← Dependencias Python
│
├── backend/                    ← API Node.js + WebSocket
│   ├── server.js               ← Express + ws (HTTP + WebSocket)
│   └── package.json
│
└── frontend/                   ← Dashboard React + Vite
    ├── src/
    │   ├── App.jsx              ← Dashboard principal
    │   ├── index.css            ← Design system oscuro
    │   └── components/
    │       ├── TornadoViewer.jsx    ← Plots Plotly (3D, corte, radial)
    │       ├── ReynoldsPanel.jsx    ← Análisis Reynolds + Kolmogorov
    │       └── PhysicsExplainer.jsx ← Explicación N-S + OpenFOAM
    └── package.json
```

---

## 🚀 Instalación y Ejecución

### Opción A: Solo el Dashboard (sin OpenFOAM)

#### 1. Backend Node.js
```bash
cd backend
npm install
npm run dev
# Servidor en http://localhost:3001
```

#### 2. Frontend React
```bash
cd frontend
npm install
npm run dev
# Dashboard en http://localhost:5173
```

El dashboard funciona en **modo demo** automáticamente si no hay datos CFD.

---

#### 3. Python (post-procesamiento)
```bash
cd python_post
pip install -r requirements.txt
python main.py
```

Genera los datos reales que el dashboard mostrará automáticamente.

---

### Opción B: Con OpenFOAM (Linux/WSL)

```bash
# ... (instrucciones de OpenFOAM)
```

---

### Opción C: Docker (Portabilidad Total — Recomendado)
Si tienes **Docker** y **Docker Compose** instalado, no necesitas instalar Node.js ni Python manualmente.

```bash
# Construir y levantar todo
docker-compose up --build

# Acceso:
# Dashboard: http://localhost:5173
# Backend API: http://localhost:3001
```

*Nota: Esta opción incluye Node.js y Python. Para OpenFOAM real dentro de Docker, se requiere una imagen especializada.*

---

```bash
# Configurar entorno OpenFOAM
source /opt/openfoam2312/etc/bashrc

# Ir al caso
cd openfoam_case

# Generar malla
blockMesh
checkMesh

# Ejecutar simulación (pimpleFoam)
pimpleFoam | tee log.pimpleFoam

# Post-procesar vorticidad
postProcess -func vorticity

# Python post-procesamiento
cd ../python_post
python main.py
```

---

## 🌪️ Modelo del Tornado

### Vórtice de Burgers (solución exacta N-S)

```python
# Radio de Burgers: δ = √(ν/a)  [escala viscosa del núcleo]
delta = sqrt(nu / a)   # ≈ 0.0038 m para aire, a=1 s⁻¹

# Velocidad tangencial (azimuthal)
u_theta(r) = Γ/(2π·r) · [1 - exp(-r²/2δ²)]

# Velocidad radial (inflow convergente)
u_r(r) = -a·r / 2

# Updraft vertical
u_z(r, z) = a·z · [1 - exp(-r²/2δ²)]
```

### Condiciones de frontera OpenFOAM

| Superficie | Tipo | Descripción |
|-----------|------|-------------|
| `bottom` | `fixedValue + turbulentIntensityKE` | Entrada con rotación + turbulencia 5% |
| `top` | `pressureInletOutletVelocity` | Salida libre (updraft) |
| `side` | `inletOutlet` | Borde abierto (flujo radial libre) |

---

## 📊 Resultados Esperados

| Magnitud | Valor | Unidades |
|----------|-------|---------|
| Velocidad máxima | ~19 | m/s |
| Vorticidad máxima | ~53 | 1/s |
| Defecto de presión | ~22 | Pa |
| Reynolds máximo | ~270,000 | — |
| Escalas Kolmogorov η | ~0.08 | mm |
| N° celdas para DNS | ~2×10¹² | — |

---

## 🎨 Visualizaciones del Dashboard

| Tab | Descripción |
|-----|-------------|
| **Corte 2D** | Heatmaps de vorticidad, velocidad, presión y régimen (Subplot 2×2) |
| **Perfil Radial** | Curvas clásicas u_θ(r), ω(r), p(r), Re(r) con zona del núcleo marcada |
| **Vista 3D** | Streamlines helicoidales del tornado + isosuperficie de vorticidad |
| **Física** | Ecuaciones N-S, modelos de vórtice, k-ε RANS |
| **OpenFOAM** | Estructura de archivos, algoritmo PIMPLE, comandos |
| **Pipeline** | Ejecutar Python en tiempo real con progreso WebSocket |

---

## 🧠 Conceptos Clave

### ¿Qué es la Vorticidad?
La vorticidad `ω = ∇×u` mide la **rotación local** de un elemento de fluido.
- Un fluido puede girar en trayectoria CIRCULAR con ω=0 (vórtice potencial)
- Un fluido puede tener ω≠0 sin seguir trayectorias circulares (flujo de Couette)
- En el núcleo del tornado: ω_z = constante → rotación de sólido rígido

### ¿Por qué k-ε en lugar de DNS?
- **DNS** (Direct Numerical Simulation): resuelve TODAS las escalas
  - Requiere `Re^(9/4) ≈ 10¹²` celdas para Re=270,000 → imposible
- **RANS k-ε**: modela las fluctuaciones turbulentas estadísticamente
  - Solo necesita ~100,000 celdas → factible en un PC

### Escalas de Turbulencia (Kolmogorov)
```
η = (ν³/ε)^(1/4) ≈ 0.08 mm    ← escala de disipación viscosa
L/η ≈ 6,000                     ← separación de escalas
→ Por eso DNS es imposible a Re~270,000
```

---

## 📦 Dependencias

### Python
```
numpy, scipy, plotly, pyvista, matplotlib, meshio
```

### Node.js
```
express, cors, helmet, morgan, ws, express-rate-limit
```

### React
```
react, react-dom, react-plotly.js, plotly.js-dist-min, vite
```

---

*Proyecto académico de Mecánica de Fluidos Computacional — 2026*
