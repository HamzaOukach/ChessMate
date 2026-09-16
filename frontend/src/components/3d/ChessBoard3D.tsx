import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { ChessPiece3D } from './ChessPiece3D';
import { isWhitePiece } from '../../hooks/useChessGame';

interface ChessBoard3DProps {
  board: string[][];
  selectedSquare: { row: number; col: number } | null;
  legalMoves: { row: number; col: number }[];
  lastBlunderSquares: { from: { row: number; col: number }; to: { row: number; col: number }; severity: string } | null;
  onSquareClick: (row: number, col: number) => void;
  isAnalysisTable?: boolean;
}

export function ChessBoard3D({
  board,
  selectedSquare,
  legalMoves,
  lastBlunderSquares,
  onSquareClick,
  isAnalysisTable = false
}: ChessBoard3DProps) {
  const [hoveredSquare, setHoveredSquare] = useState<{ row: number; col: number } | null>(null);

  const SQUARE_SIZE = 2; // taille de chaque case
  const OFFSET = (8 * SQUARE_SIZE) / 2 - (SQUARE_SIZE / 2); // pour centrer le plateau a 0,0,0

  // Materials
  const materials = useMemo(() => {
    if (isAnalysisTable) {
      return {
        lightParams: { color: '#3a3a60', emissive: '#111122', emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.4 },
        darkParams: { color: '#1a1a3a', emissive: '#050510', emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.4 },
        borderParams: { color: '#00ffff', emissive: '#00ffff', emissiveIntensity: 0.5 },
      };
    } else {
      return {
        lightParams: { color: '#f0d9b5', roughness: 0.8 },
        darkParams: { color: '#b58863', roughness: 0.8 },
        borderParams: { color: '#5c4033', roughness: 0.9 },
      };
    }
  }, [isAnalysisTable]);

  const lightMaterial = new THREE.MeshStandardMaterial(materials.lightParams);
  const darkMaterial = new THREE.MeshStandardMaterial(materials.darkParams);
  const borderMaterial = new THREE.MeshStandardMaterial(materials.borderParams);

  const hoverMaterial = new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false
  });

  const selectedMaterial = new THREE.MeshBasicMaterial({
    color: '#ffff00', transparent: true, opacity: 0.4, depthWrite: false
  });

  const blunderMaterial = new THREE.MeshBasicMaterial({
    color: '#ff0000', transparent: true, opacity: 0.6, depthWrite: false
  });
  const mistakeMaterial = new THREE.MeshBasicMaterial({
    color: '#ff8c00', transparent: true, opacity: 0.6, depthWrite: false
  });
  const inaccuracyMaterial = new THREE.MeshBasicMaterial({
    color: '#ffff00', transparent: true, opacity: 0.6, depthWrite: false
  });

  const renderSquares = () => {
    const squares = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isWhite = (row + col) % 2 === 0;
        // x est les colonnes (a-h), z est les lignes (1-8 du point de vue des noirs)
        const x = col * SQUARE_SIZE - OFFSET;
        const z = row * SQUARE_SIZE - OFFSET;

        const isSelected = selectedSquare?.row === row && selectedSquare?.col === col;
        const isHovered = hoveredSquare?.row === row && hoveredSquare?.col === col;
        const isLegalMove = legalMoves.some(m => m.row === row && m.col === col);

        const isBlunder = lastBlunderSquares && (
          (lastBlunderSquares.from.row === row && lastBlunderSquares.from.col === col) ||
          (lastBlunderSquares.to.row === row && lastBlunderSquares.to.col === col)
        );

        squares.push(
          <group key={`sq-${row}-${col}`} position={[x, 0, z]}>
            {/* la case elle meme */}
            <mesh
              receiveShadow
              rotation={[-Math.PI / 2, 0, 0]}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredSquare({ row, col }); }}
              onPointerOut={(e) => { e.stopPropagation(); setHoveredSquare(null); }}
              onClick={(e) => { e.stopPropagation(); onSquareClick(row, col); }}
            >
              <planeGeometry args={[SQUARE_SIZE, SQUARE_SIZE]} />
              <primitive object={isWhite ? lightMaterial : darkMaterial} attach="material" />
            </mesh>

            {/* mise en evidence de la selection/hover */}
            {(isSelected || isHovered || isBlunder) && (
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[SQUARE_SIZE * 0.95, SQUARE_SIZE * 0.95]} />
                <primitive
                  object={
                    isBlunder
                      ? (lastBlunderSquares?.severity === 'blunder' ? blunderMaterial
                        : lastBlunderSquares?.severity === 'mistake' ? mistakeMaterial
                          : inaccuracyMaterial)
                      : (isSelected ? selectedMaterial : hoverMaterial)
                  }
                  attach="material"
                />
              </mesh>
            )}

            {/* indicateur de coup legal (point) */}
            {isLegalMove && (
              <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[SQUARE_SIZE * 0.15, 32]} />
                <meshBasicMaterial color={isAnalysisTable ? '#00ff00' : '#4a5568'} transparent opacity={0.6} />
              </mesh>
            )}

            {/* la piece */}
            {board[row][col] !== '' && (
              <ChessPiece3D
                key={`${row}-${col}-${board[row][col]}`}
                type={board[row][col]}
                isWhite={isWhitePiece(board[row][col])}
                position={[0, 0, 0]}
                isSelected={isSelected}
                isAnalysisTable={isAnalysisTable}
                onClick={() => onSquareClick(row, col)}
              />
            )}
          </group>
        );
      }
    }
    return squares;
  };

  return (
    <group>
      {/* base / cadre du plateau */}
      <mesh position={[0, -0.51, 0]} receiveShadow castShadow>
        <boxGeometry args={[8 * SQUARE_SIZE + 1, 1, 8 * SQUARE_SIZE + 1]} />
        <primitive object={borderMaterial} attach="material" />
      </mesh>

      {/* les cases et les pieces */}
      {renderSquares()}
    </group>
  );
}
