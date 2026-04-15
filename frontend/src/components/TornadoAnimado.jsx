/**
 * TornadoAnimado.jsx
 * Visualización 3D Realista con Vectores (Quiver Plot)
 * Utiliza InstancedMesh para renderizar miles de flechas orientadas según la velocidad.
 */

import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'

const NUM_PARTICLES = 15000 // Subimos a 15k para una nube densa y estética

function VortexParticles({ simulationData }) {
  const points = useRef()
  
  // Parámetros físicos IDENTICOS al simulador Python (Factibilidad física)
  const rc    = simulationData?.statistics?.rc || 0.15
  const Gamma = simulationData?.metadata?.params ? 
                 parseFloat(simulationData.metadata.params.match(/Γ=([\d.]+)/)?.[1] || 8.0) : 8.0
  const a     = 1.0   // Straining rate (s^-1)
  const nu    = 1.0e-4 // Viscosidad cinemática aire

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
      const r     = 0.05 + Math.pow(Math.random(), 1.8) * 3.5
      const theta = Math.random() * Math.PI * 2
      const z     = Math.random() * 4.5
      
      const x = r * Math.cos(theta)
      const y = r * Math.sin(theta)
      
      pos[i * 3 + 0] = x
      pos[i * 3 + 1] = z
      pos[i * 3 + 2] = y

      // Estimación inicial
      col[i * 3 + 0] = colorBlue.r
      col[i * 3 + 1] = colorBlue.g
      col[i * 3 + 2] = colorBlue.b

      siz[i] = 1.0 + Math.random() * 2.5
      
      mt.push({
        r,
        theta,
        z,
        speed: 0.8 + Math.random() * 0.4
      })
    }
    return [pos, col, siz, mt]
  }, [Gamma])

  // 2. Bucle de animación cinemático
  useFrame((state, delta) => {
    if (!points.current || !points.current.geometry) return
    
    const time = state.clock.getElapsedTime()
    const posAttribute = points.current.geometry.attributes.position
    const colAttribute = points.current.geometry.attributes.color
    const deltaBurgers = Math.sqrt(nu / a)

    for (let i = 0; i < NUM_PARTICLES; i++) {
        const p = meta[i]
        const r = p.r
        const expTerm = 1 - Math.exp(-(r * r) / (2 * deltaBurgers * deltaBurgers))
        
        // --- Física de Burgers Técnica (Original/Lenta) ---
        const vTheta = (Gamma / (2 * Math.PI * Math.max(r, 0.01))) * expTerm
        const vr     = -a * r / 2.0
        const vz     = a * p.z * expTerm * 1.5 
        
        // Movimiento Pausado
        p.theta += (vTheta / Math.max(r, 0.01)) * delta * p.speed * 1.3
        p.r     += vr * delta * 0.05
        p.z     += vz * delta * 0.12
        
        // Reseteo original (Recirculación desde la base)
        if (p.r < 0.015 || p.z > 4.45) {
            p.z = 0.01
            p.r = 0.6 + Math.random() * 2.5
            p.theta = Math.random() * Math.PI * 2
        }

        // Devolución a la malla
        const x = p.r * Math.cos(p.theta)
        const y = p.r * Math.sin(p.theta)
        
        posAttribute.array[i * 3 + 0] = x
        posAttribute.array[i * 3 + 1] = p.z
        posAttribute.array[i * 3 + 2] = y

        // Color por Régimen (Reynolds Original)
        const mag = Math.sqrt(vr*vr + vTheta*vTheta + vz*vz)
        const Re  = (mag * rc) / nu
        
        if (Re < 2300) { // Laminar
            colAttribute.array[i * 3 + 0] = 0.13; colAttribute.array[i * 3 + 1] = 0.4; colAttribute.array[i * 3 + 2] = 1.0
        } else if (Re < 4000) { // Transición
            colAttribute.array[i * 3 + 0] = 1.0; colAttribute.array[i * 3 + 1] = 0.85; colAttribute.array[i * 3 + 2] = 0.0
        } else { // Turbulento
            colAttribute.array[i * 3 + 0] = 1.0; colAttribute.array[i * 3 + 1] = 0.26; colAttribute.array[i * 3 + 2] = 0.13
        }
    }
    posAttribute.needsUpdate = true
    colAttribute.needsUpdate = true
    
    points.current.rotation.y = time * 0.03
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={sizes.length} array={sizes} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05} // Tamaño técnico original
        vertexColors
        transparent
        opacity={0.5}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

export default function TornadoAnimado({ simulationData }) {
  return (
    <div style={{ width: '100%', height: '520px', background: '#060d18', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[5, 4, 7]} fov={45} />
        <OrbitControls enableDamping dampingFactor={0.05} />
        
        <ambientLight intensity={0.5} />
        
        <VortexParticles simulationData={simulationData} />
        
        <Stars radius={100} depth={50} count={4000} factor={4} saturation={0} fade speed={0.5} />
        <gridHelper args={[10, 10, '#1a2a3a', '#0d1621']} position={[0, -0.01, 0]} />
      </Canvas>
      
      {/* Leyenda flotante estética */}
      <div style={{
          position: 'absolute', bottom: '25px', left: '25px', 
          background: 'rgba(11,21,40,0.7)', padding: '12px', 
          borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
          fontSize: '11px', color: '#8bafd0', backdropFilter: 'blur(4px)'
      }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#00d4ff' }}>Régimen de Flujo (Partículas)</div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ width: '10px', height: '10px', background: '#2266ff', marginRight: '8px', borderRadius: '50%' }} />
              Laminar
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ width: '10px', height: '10px', background: '#ffd900', marginRight: '8px', borderRadius: '50%' }} />
              Transición
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '10px', height: '10px', background: '#ff4422', marginRight: '8px', borderRadius: '50%' }} />
              Turbulento
          </div>
      </div>
    </div>
  )
}
