import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ChessBoard3D } from './ChessBoard3D';

interface TableProps {
  board: string[][];
  selectedSquare: { row: number; col: number } | null;
  legalMoves: { row: number; col: number }[];
  lastBlunderSquares: { from: { row: number; col: number }; to: { row: number; col: number }; severity: string } | null;
  onSquareClick: (row: number, col: number) => void;
  // evalScore: number; //a rajouter plus tard
}

//les effets de poussiere en mode magnus
function Particles() {
  const count = 500;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const light = useRef<THREE.PointLight>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100;
      const factor = 20 + Math.random() * 100;
      const speed = 0.01 + Math.random() / 200;
      const xFactor = -20 + Math.random() * 40;
      const yFactor = -20 + Math.random() * 40;
      const zFactor = -20 + Math.random() * 40;
      temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 });
    }
    return temp;
  }, [count]);

  useFrame(() => {
    particles.forEach((particle, i) => {
      let { t, factor, speed, xFactor, yFactor, zFactor } = particle;
      t = particle.t += speed / 2;
      const a = Math.cos(t) + Math.sin(t * 1) / 10;
      const b = Math.sin(t) + Math.cos(t * 2) / 10;
      const s = Math.cos(t);
      dummy.position.set(
        (particle.mx / 10) * a + xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
        (particle.my / 10) * b + yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
        (particle.my / 10) * b + zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
      );
      dummy.scale.set(s, s, s);
      dummy.rotation.set(s * 5, s * 5, s * 5);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(i, dummy.matrix);
    });
    if (mesh.current) {
      mesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <pointLight ref={light} distance={40} intensity={8} color="#00ffff" />
      <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
        <dodecahedronGeometry args={[0.2, 0]} />
        <meshPhongMaterial color="#00ffff" />
      </instancedMesh>
    </>
  );
}

export function AnalysisTable(props: TableProps) {
  return (
    <group position={[40, 0, 0]}>
      {/* eclairage pour l'esthetique futuriste */}
      <ambientLight intensity={0.2} color="#101030" />
      <directionalLight position={[0, 20, 0]} intensity={2.0} color="#8a2be2" />
      <pointLight position={[10, 10, 10]} intensity={4} color="#00ffff" distance={30} />
      <pointLight position={[-10, 10, -10]} intensity={4} color="#ff00ff" distance={30} />

      {/* les particules autour de la table */}
      <Particles />

      {/* la surface de la table - look verre/tech */}
      <mesh position={[0, -2, 0]}>
        <cylinderGeometry args={[20, 18, 1, 64]} />
        <meshStandardMaterial
          color="#0a0a1a"
          metalness={0.9}
          roughness={0.1}
          emissive="#0a0a2a"
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* anneaux lumineux autour de la table */}
      <mesh position={[0, -1.8, 0]}>
        <torusGeometry args={[19.5, 0.2, 16, 100]} />
        <meshBasicMaterial color="#00ffff" />
      </mesh>

      {/* le plateau d'echecs */}
      <ChessBoard3D {...props} isAnalysisTable={true} />

      {/* la barre d'evaluation pourrait aller ici: 
      <mesh position={[12, 5, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 10, 32]} />
         ...
      </mesh> 
      */}
    </group>
  );
}
