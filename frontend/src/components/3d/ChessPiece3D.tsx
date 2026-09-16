import { useMemo } from 'react';
import * as THREE from 'three';

interface ChessPiece3DProps {
  type: string;
  isWhite: boolean;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
  isAnalysisTable?: boolean;
}

export function ChessPiece3D({ type, isWhite, position, isSelected, onClick, isAnalysisTable = false }: ChessPiece3DProps) {
  // materiaux
  const material = useMemo(() => {
    if (isAnalysisTable) {
      //materiaux futuristiques
      return new THREE.MeshStandardMaterial({
        color: isWhite ? '#00ffff' : '#ff00ff',
        emissive: isWhite ? '#00ffff' : '#ff00ff',
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.9,
      });
    } else {
      //materiau en bois
      return new THREE.MeshStandardMaterial({
        color: isWhite ? '#e6d5b8' : '#3a2d24',
        roughness: 0.7,
        metalness: 0.1,
      });
    }
  }, [isWhite, isAnalysisTable]);

  //materiau de selection
  const selectionMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#ffff00',
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.5,
    });
  }, []);

  //decalage vertical pour que la piece monte quand elle est selectionnee
  const yOffset = isSelected ? 0.3 : 0;
  const finalPosition: [number, number, number] = [position[0], position[1] + yOffset, position[2]];

  //render les differentes formes des pieces
  const renderGeometry = () => {
    switch (type) {
      case '♙':
      case '♟': //pion
        return (
          <group>
            <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.4, 0.8, 16]} />
              <primitive object={material} attach="material" />
            </mesh>
            <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
              <sphereGeometry args={[0.3, 16, 16]} />
              <primitive object={material} attach="material" />
            </mesh>
          </group>
        );

      case '♖':
      case '♜': // tour
        return (
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.4, 0.45, 1, 16]} />
            <primitive object={material} attach="material" />
          </mesh>
        );

      case '♘':
      case '♞': // cavalier
        return (
          <group>
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.4, 0.45, 1, 16]} />
              <primitive object={material} attach="material" />
            </mesh>
            <mesh position={[0.1, 1.0, 0]} rotation={[0, 0, -0.3]} castShadow receiveShadow>
              <boxGeometry args={[0.6, 0.4, 0.4]} />
              <primitive object={material} attach="material" />
            </mesh>
          </group>
        );

      case '♗':
      case '♝': // fou
        return (
          <group>
            <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.2, 0.4, 1.2, 16]} />
              <primitive object={material} attach="material" />
            </mesh>
            <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
              <coneGeometry args={[0.25, 0.5, 16]} />
              <primitive object={material} attach="material" />
            </mesh>
          </group>
        );

      case '♕':
      case '♛': // dame
        return (
          <group>
            <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.45, 1.6, 16]} />
              <primitive object={material} attach="material" />
            </mesh>
            <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.4, 0.2, 0.3, 16]} />
              <primitive object={material} attach="material" />
            </mesh>
            <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
              <sphereGeometry args={[0.2, 16, 16]} />
              <primitive object={material} attach="material" />
            </mesh>
          </group>
        );

      case '♔':
      case '♚': // roi
        return (
          <group>
            <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.45, 1.6, 16]} />
              <primitive object={material} attach="material" />
            </mesh>
            <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
              <primitive object={material} attach="material" />
            </mesh>
            <mesh position={[0, 2.0, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.15, 0.4, 0.15]} />
              <primitive object={material} attach="material" />
            </mesh>
            <mesh position={[0, 2.0, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.4, 0.15, 0.15]} />
              <primitive object={material} attach="material" />
            </mesh>
          </group>
        );

      default:
        return null;
    }
  };

  return (
    <group
      position={finalPosition}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      scale={isSelected ? [1.1, 1.1, 1.1] : [1, 1, 1]}
    >
      {renderGeometry()}
      {/* boite de collision invisible pour cliquer plus facilement */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 2, 8]} />
        <meshBasicMaterial transparent={true} opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
