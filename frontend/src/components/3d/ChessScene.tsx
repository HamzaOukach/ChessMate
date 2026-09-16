import { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraControls, Environment, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { PlayTable } from './PlayTable';
import { AnalysisTable } from './AnalysisTable';
import * as THREE from 'three';

interface ChessSceneProps {
  board: string[][];
  selectedSquare: { row: number; col: number } | null;
  legalMoves: { row: number; col: number }[];
  lastBlunderSquares: { from: { row: number; col: number }; to: { row: number; col: number }; severity: string } | null;
  onSquareClick: (row: number, col: number) => void;
  currentView: 'play' | 'analysis';
}

function SceneContent({ currentView, ...props }: ChessSceneProps) {
  const cameraControlsRef = useRef<CameraControls>(null);

  //transition entre les deux tables
  useEffect(() => {
    if (!cameraControlsRef.current) return;

    // position de la table de jeu
    const playTarget = new THREE.Vector3(0, 0, 0);
    const playCamera = new THREE.Vector3(0, 15, 12); // Angled down slightly

    // position de la table d'analyse
    const analysisTarget = new THREE.Vector3(40, 0, 0);
    const analysisCamera = new THREE.Vector3(40, 18, 14);

    const cc = cameraControlsRef.current;

    if (currentView === 'play') {
      cc.setLookAt(
        playCamera.x, playCamera.y, playCamera.z,
        playTarget.x, playTarget.y, playTarget.z,
        true // animer
      );
    } else {
      cc.setLookAt(
        analysisCamera.x, analysisCamera.y, analysisCamera.z,
        analysisTarget.x, analysisTarget.y, analysisTarget.z,
        true // animer
      );
    }
  }, [currentView]);

  return (
    <>
      <CameraControls
        ref={cameraControlsRef}
        minDistance={5}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2 - 0.1} // ne pas aller en dessous de la table
        smoothTime={0.8} // transition plus lente et cinematique
      />

      {/* Background Environment */}
      <color attach="background" args={['#050510']} />
      <fog attach="fog" args={['#050510', 20, 80]} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Environment preset="night" />

      {/* les deux tables */}
      <PlayTable {...props} />
      <AnalysisTable {...props} />

      {/* les effets de post-processing (glow/bloom) */}
      <EffectComposer disableNormalPass>
        <Bloom
          luminanceThreshold={0.5}
          luminanceSmoothing={0.9}
          intensity={1.5}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export function ChessScene(props: ChessSceneProps) {
  return (
    <div className="w-full h-full absolute inset-0 -z-10">
      <Canvas shadows camera={{ position: [0, 15, 12], fov: 45 }}>
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
}
