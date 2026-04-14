/**
 * TornadoAnimado.jsx
 * Visualización 3D Realista con Three.js
 * Anima partículas rotando en un vórtice de Burgers
 */

import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'

const NUM_PARTICLES = 12000

function VortexParticles({ simulationData }) {
  const points = useRef()
  
  // Extraer parámetros físicos si están disponibles (o usar defaults de Burgers)
  const rc    = simulationData?.statistics?.rc || 0.4
  const Gamma = simulationData?.statistics?.Gamma || 8.0
  const a     = 1.2 // Stretching rate
  const nu    = 1.48e-5

  // 1. Inicializar posiciones y datos de partículas
  const [positions, colors, sizes, meta] = useMemo(() => {
    const pos = new Float32Array(NUM_PARTICLES * 3)
    const col = new Float32Array(NUM_PARTICLES * 3)
    const siz = new Float32Array(NUM_PARTICLES)
    const mt  = []

    const colorBlue = new THREE.Color('#2266ff')
    const colorGold = new THREE.Color('#ffd900')
    const colorRed  = new THREE.Color('#ff4422')

    for (let i = 0; i < NUM_PARTICLES; i++) {
      // Distribución inicial aleatoria en cilindro
      const r     = 0.1 + Math.random() * 2.5
      const theta = Math.random() * Math.PI * 2
      const z     = Math.random() * 4.5
      
      const x = r * Math.cos(theta)
      const y = r * Math.sin(theta)
      
      pos[i * 3 + 0] = x
      pos[i * 3 + 1] = z // En Three.js Y es Up, pero aquí mapeamos Z de CFD a Y de Three
      pos[i * 3 + 2] = y

      // Estimar Reynolds local para color inicial
      // Re = (U * L) / nu. U aprox r*omega.
      const Re = (Gamma / (2 * Math.PI)) * (r/rc) * 1000 // Simplificado para demo visual
      
      let pColor = colorRed
      if (Re < 2300) pColor = colorBlue
      else if (Re < 4000) pColor = colorGold

      col[i * 3 + 0] = pColor.r
      col[i * 3 + 1] = pColor.g
      col[i * 3 + 2] = pColor.b

      siz[i] = 1.0 + Math.random() * 2.0
      
      mt.push({
        r,
        theta,
        z,
        speed: 1.0 + Math.random() * 2.5
      })
    }
    return [pos, col, siz, mt]
  }, [Gamma, rc])

  // 2. Bucle de animación
  useFrame((state, delta) => {
    if (!points.current || !points.current.geometry) return
    
    const time = state.clock.getElapsedTime()
    const posAttribute = points.current.geometry.attributes.position

    for (let i = 0; i < NUM_PARTICLES; i++) {
        const p = meta[i]
        
        // --- Física del Vórtice de Burgers ---
        const r = p.r
        const deltaBurgers = Math.sqrt(nu / a)
        
        // Velocidad tangencial (rotación)
        const vTheta = (Gamma / (2 * Math.PI * Math.max(r, 0.01))) * (1 - Math.exp(-(r * r) / (2 * deltaBurgers * deltaBurgers)))
        const dTheta = (vTheta / Math.max(r, 0.01)) * delta * p.speed * 1.5
        
        p.theta += dTheta
        
        // Velocidad radial (inflow)
        const vr = -a * r / 2
        p.r += vr * delta * 0.1
        if (p.r < 0.05) p.r = 1.5 + Math.random() * 1.5 // Reset al borde
        
        // Velocidad vertical (updraft)
        const vz = a * p.z
        p.z += vz * delta * 0.2
        if (p.z > 4.5) {
            p.z = 0.01
            p.r = 0.1 + Math.random() * 1.5
        }

        // Actualizar posición final
        const x = p.r * Math.cos(p.theta)
        const y = p.r * Math.sin(p.theta)
        
        posAttribute.array[i * 3 + 0] = x
        posAttribute.array[i * 3 + 1] = p.z
        posAttribute.array[i * 3 + 2] = y
    }
    posAttribute.needsUpdate = true
    
    // Rotación suave de cámara lenta
    points.current.rotation.y = time * 0.1
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={sizes.length}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default function TornadoAnimado({ simulationData }) {
  return (
    <div style={{ width: '100%', height: '520px', background: '#060d18', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
      <Canvas>
        <PerspectiveCamera makeDefault position={[5, 4, 5]} fov={50} />
        <OrbitControls enableDamping dampingFactor={0.05} />
        
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        <VortexParticles simulationData={simulationData} />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        {/* Suelo decorativo con rejilla */}
        <gridHelper args={[10, 10, '#1a2a3a', '#0d1621']} position={[0, 0, 0]} />
      </Canvas>
      
      {/* Leyenda flotante */}
      <div style={{
          position: 'absolute', bottom: '20px', left: '20px', 
          background: 'rgba(11,21,40,0.8)', padding: '10px', 
          borderRadius: '8px', border: '1px solid #1a2a3a',
          fontSize: '11px', color: '#8bafd0', pointerEvents: 'none'
      }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Régimen de Flujo (Colores)</div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
              <div style={{ width: '10px', height: '10px', background: '#2266ff', marginRight: '8px', borderRadius: '2px' }} />
              Laminar (Re &lt; 2300)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
              <div style={{ width: '10px', height: '10px', background: '#ffd900', marginRight: '8px', borderRadius: '2px' }} />
              Transición (2300 - 4000)
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '10px', height: '10px', background: '#ff4422', marginRight: '8px', borderRadius: '2px' }} />
              Turbulento (Re &gt; 4000)
          </div>
      </div>
    </div>
  )
}
