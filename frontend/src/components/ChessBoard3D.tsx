import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Float, Text } from '@react-three/drei'
import * as THREE from 'three'
import { Chess } from 'chess.js'

/* ─── Floating Particles ─── */
function Particles({ count = 80, color = "#38bdf8", dangerMode = false }: { count?: number, color?: string, dangerMode?: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * 14,
        Math.random() * 8 + 1,
        (Math.random() - 0.5) * 14,
      ],
      speed: Math.random() * 0.3 + 0.1,
      offset: Math.random() * Math.PI * 2,
      scale: Math.random() * 0.04 + 0.015,
    }))
  }, [count])

  useFrame(({ clock }) => {
    particles.forEach((p, i) => {
      const t = clock.getElapsedTime() * p.speed + p.offset
      dummy.position.set(
        p.position[0] + Math.sin(t) * 0.5,
        p.position[1] + Math.sin(t * 1.3) * 0.3,
        p.position[2] + Math.cos(t) * 0.5
      )
      dummy.scale.setScalar(p.scale * (1 + Math.sin(t * 2) * 0.3))
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  const particleColor = dangerMode ? "#f43f5e" : color

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={particleColor} transparent opacity={0.6} />
    </instancedMesh>
  )
}

/* ─── Threat Pulse Ring (for suspicious moves) ─── */
function ThreatRing({ position }: { position: [number, number, number] }) {
  const ringRef = useRef<THREE.Mesh>(null!)
  
  useFrame(({ clock }) => {
    if (ringRef.current) {
      const t = clock.getElapsedTime()
      const scale = 1 + Math.sin(t * 3) * 0.15
      ringRef.current.scale.set(scale, 1, scale)
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.4 + Math.sin(t * 4) * 0.2
    }
  })

  return (
    <mesh ref={ringRef} position={[position[0], 0.2, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.35, 0.5, 32]} />
      <meshBasicMaterial color="#f43f5e" transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  )
}

/* ─── Detailed Chess Piece ─── */
function DetailedPiece({ position, color, type, isSuspicious }: { position: [number, number, number], color: string, type: string, isSuspicious?: boolean }) {
  const isWhite = color === "#fff";
  
  // Premium material colors: white = marble, black = obsidian
  const matColor = isSuspicious 
    ? "#f43f5e" 
    : (isWhite ? "#f1f0eb" : "#1a1a2e");
  
  const emissive = isSuspicious 
    ? "#be123c" 
    : (isWhite ? "#d4af37" : "#6366f1");

  const matProps = {
    color: matColor,
    roughness: isWhite ? 0.15 : 0.08,
    metalness: isWhite ? 0.3 : 0.9,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    emissive: emissive,
    emissiveIntensity: isSuspicious ? 0.5 : 0.03,
  };

  const t = type.toLowerCase();
  
  return (
    <group position={position}>
      <Float speed={1.2} rotationIntensity={0.05} floatIntensity={0.12}>
        <mesh castShadow>
          {/* PAWN */}
          {t === 'p' && (
             <group position={[0, -0.4, 0]}>
               <mesh position={[0, 0.08, 0]}>
                  <cylinderGeometry args={[0.28, 0.33, 0.12, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 0.38, 0]}>
                  <cylinderGeometry args={[0.13, 0.23, 0.55, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 0.65, 0]}>
                  <cylinderGeometry args={[0.18, 0.18, 0.08, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 0.82, 0]}>
                  <sphereGeometry args={[0.17, 32, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
             </group>
          )}

          {/* ROOK */}
          {t === 'r' && (
             <group position={[0, -0.4, 0]}>
               <mesh position={[0, 0.08, 0]}>
                  <cylinderGeometry args={[0.32, 0.37, 0.16, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 0.48, 0]}>
                  <cylinderGeometry args={[0.25, 0.3, 0.7, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 0.88, 0]}>
                  <cylinderGeometry args={[0.32, 0.25, 0.15, 8]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               {/* Battlements */}
               {[0, 1.57, 3.14, 4.71].map((angle, idx) => (
                 <mesh key={idx} position={[Math.cos(angle) * 0.22, 1.02, Math.sin(angle) * 0.22]}>
                    <boxGeometry args={[0.1, 0.12, 0.1]} />
                    <meshPhysicalMaterial {...matProps} />
                 </mesh>
               ))}
             </group>
          )}

          {/* KNIGHT */}
          {t === 'n' && (
             <group position={[0, -0.4, 0]}>
               <mesh position={[0, 0.08, 0]}>
                  <cylinderGeometry args={[0.32, 0.37, 0.16, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 0.45, 0]} rotation={[0.15, 0, 0]}>
                  <boxGeometry args={[0.28, 0.65, 0.4]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 0.78, 0.15]} rotation={[-0.3, 0, 0]}>
                  <boxGeometry args={[0.22, 0.4, 0.35]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               {/* Snout */}
               <mesh position={[0, 0.65, 0.35]}>
                  <cylinderGeometry args={[0.08, 0.12, 0.25, 16]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               {/* Ear */}
               <mesh position={[0, 0.95, 0.05]} rotation={[0.3, 0, 0]}>
                  <coneGeometry args={[0.06, 0.15, 8]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
             </group>
          )}

          {/* BISHOP */}
          {t === 'b' && (
             <group position={[0, -0.4, 0]}>
               <mesh position={[0, 0.08, 0]}>
                  <cylinderGeometry args={[0.32, 0.37, 0.16, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 0.48, 0]}>
                  <cylinderGeometry args={[0.12, 0.27, 0.7, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 0.9, 0]}>
                  <sphereGeometry args={[0.14, 32, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               {/* Slit */}
               <mesh position={[0, 0.95, 0.08]} rotation={[0.5, 0, 0]}>
                  <boxGeometry args={[0.02, 0.18, 0.08]} />
                  <meshPhysicalMaterial color="#000" roughness={1} metalness={0} />
               </mesh>
               <mesh position={[0, 1.08, 0]}>
                  <sphereGeometry args={[0.04, 16, 16]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
             </group>
          )}

          {/* QUEEN */}
          {t === 'q' && (
             <group position={[0, -0.4, 0]}>
               <mesh position={[0, 0.08, 0]}>
                  <cylinderGeometry args={[0.37, 0.42, 0.16, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 0.55, 0]}>
                  <cylinderGeometry args={[0.17, 0.32, 0.9, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 1.05, 0]}>
                  <cylinderGeometry args={[0.3, 0.17, 0.18, 16]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               {/* Crown points */}
               {[0, 1.05, 2.09, 3.14, 4.19, 5.24].map((angle, idx) => (
                 <mesh key={idx} position={[Math.cos(angle) * 0.22, 1.2, Math.sin(angle) * 0.22]}>
                    <sphereGeometry args={[0.04, 12, 12]} />
                    <meshPhysicalMaterial {...matProps} emissive={isWhite ? "#d4af37" : "#818cf8"} emissiveIntensity={0.3} />
                 </mesh>
               ))}
               <mesh position={[0, 1.22, 0]}>
                  <sphereGeometry args={[0.08, 16, 16]} />
                  <meshPhysicalMaterial {...matProps} emissive={isWhite ? "#d4af37" : "#818cf8"} emissiveIntensity={0.2} />
               </mesh>
             </group>
          )}

          {/* KING */}
          {t === 'k' && (
             <group position={[0, -0.4, 0]}>
               <mesh position={[0, 0.08, 0]}>
                  <cylinderGeometry args={[0.37, 0.42, 0.16, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 0.6, 0]}>
                  <cylinderGeometry args={[0.17, 0.32, 1.0, 32]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               <mesh position={[0, 1.15, 0]}>
                  <cylinderGeometry args={[0.32, 0.17, 0.25, 16]} />
                  <meshPhysicalMaterial {...matProps} />
               </mesh>
               {/* Cross */}
               <mesh position={[0, 1.42, 0]}>
                  <boxGeometry args={[0.08, 0.28, 0.08]} />
                  <meshPhysicalMaterial {...matProps} emissive={isWhite ? "#d4af37" : "#818cf8"} emissiveIntensity={0.15} />
               </mesh>
               <mesh position={[0, 1.48, 0]}>
                  <boxGeometry args={[0.22, 0.08, 0.08]} />
                  <meshPhysicalMaterial {...matProps} emissive={isWhite ? "#d4af37" : "#818cf8"} emissiveIntensity={0.15} />
               </mesh>
             </group>
          )}
        </mesh>
      </Float>
    </group>
  )
}

/* ─── Board Square ─── */
function Square({ position, isDark, isSuspicious, isLastMove }: { position: [number, number, number], isDark: boolean, isSuspicious?: boolean, isLastMove?: boolean }) {
  const darkColor = "#1e293b";
  const lightColor = "#94a3b8";
  const baseColor = isDark ? darkColor : lightColor;
  const finalColor = isSuspicious ? "#ef4444" : (isLastMove ? "#3b82f6" : baseColor);
  
  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={[0.97, 0.25, 0.97]} />
      <meshPhysicalMaterial 
        color={finalColor} 
        metalness={isDark ? 0.7 : 0.3} 
        roughness={isDark ? 0.05 : 0.1}
        clearcoat={1}
        clearcoatRoughness={0.05}
        emissive={isSuspicious ? "#ef4444" : (isLastMove ? "#2563eb" : "#000000")}
        emissiveIntensity={isSuspicious ? 0.5 : (isLastMove ? 0.15 : 0)}
      />
    </mesh>
  )
}

/* ─── Board Frame ─── */
function BoardFrame() {
  const frameColor = "#0c0a09";
  const frameMatProps = {
    color: frameColor,
    metalness: 0.9,
    roughness: 0.1,
    clearcoat: 1,
    emissive: "#d4af37",
    emissiveIntensity: 0.05,
  };

  return (
    <group>
      {/* Main base */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <boxGeometry args={[8.8, 0.15, 8.8]} />
        <meshPhysicalMaterial {...frameMatProps} />
      </mesh>
      {/* Bottom pad */}
      <mesh position={[0, -0.32, 0]} receiveShadow>
        <boxGeometry args={[9.2, 0.1, 9.2]} />
        <meshPhysicalMaterial color="#0a0a0a" metalness={0.95} roughness={0.05} clearcoat={1} />
      </mesh>
      {/* Gold trim edges */}
      {[
        [0, -0.15, 4.25, 8.8, 0.08, 0.08],
        [0, -0.15, -4.25, 8.8, 0.08, 0.08],
        [4.25, -0.15, 0, 0.08, 0.08, 8.8],
        [-4.25, -0.15, 0, 0.08, 0.08, 8.8],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]}>
          <boxGeometry args={[w as number, h as number, d as number]} />
          <meshPhysicalMaterial color="#d4af37" metalness={1} roughness={0.15} emissive="#d4af37" emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  )
}

/* ─── Board Coordinates ─── */
function BoardCoordinates() {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  
  return (
    <group>
      {/* File labels (a-h) along the bottom */}
      {files.map((file, i) => (
        <Text
          key={`file-${file}`}
          position={[i - 3.5, -0.15, 4.6]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.22}
          color="#d4af37"
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {file}
        </Text>
      ))}
      {/* Rank labels (1-8) along the left */}
      {ranks.map((rank, i) => (
        <Text
          key={`rank-${rank}`}
          position={[-4.6, -0.15, i - 3.5]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.22}
          color="#d4af37"
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {rank}
        </Text>
      ))}
    </group>
  )
}

/* ─── Animated Grid Floor ─── */
function GridFloor() {
  const meshRef = useRef<THREE.Mesh>(null!)
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.03 + Math.sin(clock.getElapsedTime() * 0.5) * 0.01
    }
  })

  return (
    <mesh ref={meshRef} position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.03} wireframe />
    </mesh>
  )
}

/* ─── Main Chess Board 3D Component ─── */
export function ChessBoard3D({ pgn, cheatScore = 0, suspiciousMoveIndices }: { pgn?: string, cheatScore?: number, suspiciousMoveIndices?: number[] }) {
  const [board, setBoard] = useState<({ type: string, color: string } | null)[][]>([]);
  const chessRef = useRef(new Chess());
  const [currentMove, setCurrentMove] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [suspiciousIndices, setSuspiciousIndices] = useState<number[]>([]);
  const [lastMoveSquare, setLastMoveSquare] = useState<string | null>(null);

  // Initialize and Reset Game State
  useEffect(() => {
    const c = new Chess();
    let parsedMoves: string[] = [];
    let isCheater = cheatScore > 50;

    if (pgn) {
      try {
        c.loadPgn(pgn);
        parsedMoves = c.history();
      } catch (e) {
        console.error("Invalid PGN provided");
      }
    }
    
    chessRef.current = new Chess();
    setMoves(parsedMoves);
    setCurrentMove(0);
    setBoard(chessRef.current.board());
    setLastMoveSquare(null);

    // Use explicit indices if provided, otherwise auto-generate from cheatScore
    if (suspiciousMoveIndices && suspiciousMoveIndices.length > 0) {
        setSuspiciousIndices(suspiciousMoveIndices);
    } else if (isCheater && parsedMoves.length > 5) {
        const suspiciousCount = Math.floor(Math.random() * 3) + 2;
        const endRange = parsedMoves.length;
        const startRange = Math.max(0, endRange - 10);
        
        const indices = new Set<number>();
        while(indices.size < suspiciousCount && indices.size < (endRange - startRange)) {
            indices.add(Math.floor(Math.random() * (endRange - startRange)) + startRange);
        }
        setSuspiciousIndices(Array.from(indices));
    } else {
        setSuspiciousIndices([]);
    }
  }, [pgn, cheatScore, suspiciousMoveIndices]);

  // Animation Loop
  useEffect(() => {
    if (moves.length === 0 || currentMove >= moves.length) return;

    const timeout = setTimeout(() => {
      chessRef.current.move(moves[currentMove]);
      setBoard([...chessRef.current.board()]);
      
      // Track last move destination
      const history = chessRef.current.history({ verbose: true });
      const lastMove = history[history.length - 1];
      if (lastMove) {
        setLastMoveSquare(lastMove.to);
      }
      
      setCurrentMove((c) => c + 1);
    }, 500);

    return () => clearTimeout(timeout);
  }, [currentMove, moves]);

  const isCurrentMoveSuspicious = suspiciousIndices.includes(currentMove - 1);
  const isGameComplete = moves.length > 0 && currentMove >= moves.length;
  const progressPercent = moves.length > 0 ? Math.round((currentMove / moves.length) * 100) : 0;

  const pieces: JSX.Element[] = [];
  const squares: JSX.Element[] = [];
  const threatRings: JSX.Element[] = [];
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const squareName = `${String.fromCharCode(97 + col)}${8 - row}`;
      const piece = board[row]?.[col];
      
      const x = col - 3.5;
      const z = row - 3.5;
      
      let isSquareSuspicious = false;
      let isLastMoveSquareMatch = squareName === lastMoveSquare && !isCurrentMoveSuspicious;

      if (isCurrentMoveSuspicious) {
          const history = chessRef.current.history({ verbose: true });
          const lastMoveData = history[history.length - 1];
          if (lastMoveData) {
              // Highlight BOTH from (origin) and to (destination) squares in red
              if (lastMoveData.to === squareName || lastMoveData.from === squareName) {
                  isSquareSuspicious = true;
              }
          }
      }

      squares.push(
        <Square 
          key={`sq-${row}-${col}`} 
          position={[x, 0, z]} 
          isDark={(row + col) % 2 === 1} 
          isSuspicious={isSquareSuspicious}
          isLastMove={isLastMoveSquareMatch}
        />
      );

      if (isSquareSuspicious) {
        threatRings.push(
          <ThreatRing key={`threat-${row}-${col}`} position={[x, 0, z]} />
        );
      }

      if (piece) {
        pieces.push(
          <DetailedPiece 
            key={`p-${row}-${col}-${piece.type}-${piece.color}`}
            position={[x, 0.35, z]} 
            color={piece.color === 'w' ? "#fff" : "#1e293b"} 
            type={piece.type} 
            isSuspicious={isSquareSuspicious}
          />
        );
      }
    }
  }

  const renderMock = pieces.length === 0;

  return (
    <div className="w-full h-[550px] bg-slate-950/60 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(56,189,248,0.08)] relative border border-slate-800/50">
      {/* Top-left HUD */}
      <div className="absolute top-4 left-4 z-10 text-white bg-slate-950/90 backdrop-blur-xl p-5 rounded-2xl border border-white/5 shadow-2xl min-w-[200px]">
        <h3 className="text-xs font-bold text-cyan-400 m-0 flex items-center gap-2 uppercase tracking-[0.15em]">
            <span className={`w-2 h-2 rounded-full ${isCurrentMoveSuspicious ? 'bg-red-500 shadow-[0_0_12px_#f43f5e]' : (isGameComplete ? 'bg-emerald-400' : 'bg-cyan-400')} animate-pulse`}></span>
            Hologramme Tactique
        </h3>
        <p className="text-xs text-slate-500 mt-2 font-mono">
            {moves.length > 0 
                ? `Coup ${currentMove} / ${moves.length}` 
                : "En attente d'un PGN..."}
        </p>
        
        {/* Progress bar */}
        {moves.length > 0 && (
          <div className="mt-3">
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-300 rounded-full"
                style={{ 
                  width: `${progressPercent}%`, 
                  backgroundColor: isCurrentMoveSuspicious ? '#f43f5e' : '#06b6d4'
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-slate-600 font-mono">{progressPercent}%</span>
              <span className="text-[9px] text-slate-600 font-mono">{isGameComplete ? '✓ FIN' : '▶ PLAY'}</span>
            </div>
          </div>
        )}
        
        {isCurrentMoveSuspicious && (
            <div className="mt-3 text-[10px] text-red-400 font-bold uppercase tracking-[0.2em] bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                Anomalie Détectée
            </div>
        )}
      </div>

      {/* Score badge top-right */}
      {cheatScore > 0 && (
        <div className="absolute top-4 right-4 z-10">
          <div className={`px-4 py-2 rounded-xl backdrop-blur-xl border text-xs font-black tracking-wider ${
            cheatScore > 70 
              ? 'bg-red-950/80 border-red-500/30 text-red-400' 
              : cheatScore > 40 
                ? 'bg-amber-950/80 border-amber-500/30 text-amber-400'
                : 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400'
          }`}>
            SCORE: {cheatScore.toFixed(0)}%
          </div>
        </div>
      )}
      
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 7, 8]} fov={45} />
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05} 
          minPolarAngle={0.2} 
          maxPolarAngle={Math.PI / 2.2} 
          autoRotate={!pgn || isGameComplete}
          autoRotateSpeed={0.3}
          minDistance={6}
          maxDistance={18}
        />
        
        {/* Lighting */}
        <ambientLight intensity={0.15} />
        <pointLight 
          position={[8, 12, 8]} 
          intensity={1.8} 
          color={isCurrentMoveSuspicious ? "#f43f5e" : "#38bdf8"} 
          castShadow 
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-8, 8, -8]} intensity={0.8} color="#818cf8" />
        <pointLight position={[0, 3, 8]} intensity={0.4} color="#d4af37" />
        <spotLight 
          position={[0, 18, 0]} 
          angle={0.25} 
          penumbra={1} 
          intensity={2.5} 
          color="#ffffff" 
          castShadow 
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        {/* Rim light */}
        <directionalLight position={[-5, 2, -5]} intensity={0.3} color="#6366f1" />
        
        <group rotation={[0, 0, 0]}>
          {squares}
          {threatRings}
          <BoardFrame />
          <BoardCoordinates />
          {renderMock ? (
              <>
                <DetailedPiece position={[-3.5, 0.35, -3.5]} color="#1e293b" type="r" />
                <DetailedPiece position={[-2.5, 0.35, -3.5]} color="#1e293b" type="n" />
                <DetailedPiece position={[-1.5, 0.35, -3.5]} color="#1e293b" type="b" />
                <DetailedPiece position={[-0.5, 0.35, -3.5]} color="#1e293b" type="q" />
                <DetailedPiece position={[0.5, 0.35, -3.5]} color="#1e293b" type="k" />
                <DetailedPiece position={[1.5, 0.35, -3.5]} color="#1e293b" type="b" />
                <DetailedPiece position={[2.5, 0.35, -3.5]} color="#1e293b" type="n" />
                <DetailedPiece position={[3.5, 0.35, -3.5]} color="#1e293b" type="r" />
                {[-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5].map((x) => (
                  <DetailedPiece key={`bp-${x}`} position={[x, 0.35, -2.5]} color="#1e293b" type="p" />
                ))}

                <DetailedPiece position={[-3.5, 0.35, 3.5]} color="#fff" type="r" />
                <DetailedPiece position={[-2.5, 0.35, 3.5]} color="#fff" type="n" />
                <DetailedPiece position={[-1.5, 0.35, 3.5]} color="#fff" type="b" />
                <DetailedPiece position={[-0.5, 0.35, 3.5]} color="#fff" type="q" />
                <DetailedPiece position={[0.5, 0.35, 3.5]} color="#fff" type="k" />
                <DetailedPiece position={[1.5, 0.35, 3.5]} color="#fff" type="b" />
                <DetailedPiece position={[2.5, 0.35, 3.5]} color="#fff" type="n" />
                <DetailedPiece position={[3.5, 0.35, 3.5]} color="#fff" type="r" />
                {[-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5].map((x) => (
                  <DetailedPiece key={`wp-${x}`} position={[x, 0.35, 2.5]} color="#fff" type="p" />
                ))}
              </>
          ) : pieces}
        </group>
        
        <Particles count={60} dangerMode={isCurrentMoveSuspicious} />
        <GridFloor />
        
        <ContactShadows 
          position={[0, -0.5, 0]} 
          opacity={0.6} 
          scale={20} 
          blur={2.5} 
          far={5} 
          color={isCurrentMoveSuspicious ? "#be123c" : "#020617"}
        />
        
        <Environment preset="night" />
      </Canvas>
    </div>
  )
}
