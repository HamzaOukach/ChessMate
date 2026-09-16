import { ChessBoard3D } from './ChessBoard3D';

interface TableProps {
  board: string[][];
  selectedSquare: { row: number; col: number } | null;
  legalMoves: { row: number; col: number }[];
  lastBlunderSquares: { from: { row: number; col: number }; to: { row: number; col: number }; severity: string } | null;
  onSquareClick: (row: number, col: number) => void;
}

export function PlayTable(props: TableProps) {
  return (
    <group position={[0, 0, 0]}>
      {/* Lighting for warm aesthetic */}
      <ambientLight intensity={0.5} color="#fff1e0" />
      <directionalLight 
        position={[10, 20, 10]} 
        intensity={1.5} 
        color="#ffecd6" 
        castShadow 
        shadow-mapSize-width={2048} 
        shadow-mapSize-height={2048} 
        shadow-camera-far={50} 
        shadow-camera-left={-20} 
        shadow-camera-right={20} 
        shadow-camera-top={20} 
        shadow-camera-bottom={-20} 
      />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#ffd4a3" />

      {/* The Table Surface */}
      <mesh position={[0, -2, 0]} receiveShadow>
        <cylinderGeometry args={[18, 16, 2, 64]} />
        <meshStandardMaterial color="#302013" roughness={0.8} />
      </mesh>

      {/* The Chess Board */}
      <ChessBoard3D {...props} isAnalysisTable={false} />
    </group>
  );
}
