import os
import chess
import chess.engine
from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Stockfish Engine")

# Wide CORS for development stability
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/api/chess")

# Stockfish binary path (installed via apt-get in Dockerfile)
STOCKFISH_PATH = os.environ.get("STOCKFISH_PATH", "/usr/games/stockfish")

@app.get("/health")
def health():
    return {"status": "ok", "engine": "stockfish", "path": STOCKFISH_PATH}

@router.get("/health")
def api_health():
    return {"status": "ok", "engine": "stockfish"}

@router.get("/bestmove")
async def get_best_move(moves: str = "", mode: str = "depth", color: str = "black", depth: int = 15, movetime: int = 1000):
    try:
        board = chess.Board()
        if moves:
            for m in moves.split():
                if m.strip():
                    try:
                        board.push_uci(m)
                    except ValueError:
                        pass # Ignore invalid moves
        
        limit = chess.engine.Limit(depth=depth) if mode == "depth" else chess.engine.Limit(time=movetime/1000.0)
        
        if not os.path.exists(STOCKFISH_PATH):
            raise HTTPException(status_code=500, detail=f"Stockfish binary not found at {STOCKFISH_PATH}")
            
        with chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH) as engine:
            result = engine.play(board, limit)
            return {"bestmove": result.move.uci() if result.move else ""}
    except Exception as e:
        print(f"❌ Stockfish error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/evaluate")
async def evaluate_position(moves: str = "", depth: int = 15):
    """Evaluate a position and return the score in centipawns."""
    try:
        board = chess.Board()
        if moves:
            for m in moves.split():
                if m.strip():
                    try:
                        board.push_uci(m)
                    except ValueError:
                        pass

        if not os.path.exists(STOCKFISH_PATH):
            raise HTTPException(status_code=500, detail=f"Stockfish binary not found at {STOCKFISH_PATH}")

        with chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH) as engine:
            info = engine.analyse(board, chess.engine.Limit(depth=depth))
            score = info["score"].relative  # from side-to-move's perspective

            is_mate = score.is_mate()
            if is_mate:
                mate_in = score.mate()
                cp_score = 100000 if mate_in > 0 else -100000
            else:
                cp_score = score.score(mate_score=100000)

            # Get best move too
            result = engine.play(board, chess.engine.Limit(depth=depth))
            best_move = result.move.uci() if result.move else ""

            return {
                "score": cp_score,
                "isMate": is_mate,
                "bestMove": best_move,
            }
    except Exception as e:
        print(f"Evaluate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

app.include_router(router)
