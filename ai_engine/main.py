import os

import chess
import numpy as np
import onnxruntime as ort

import asyncio
import uuid
import json
import time
import httpx
from typing import Dict, List, Optional, Set
from fastapi import FastAPI, HTTPException, APIRouter, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# Initialize FastAPI app and router AT THE TOP to prevent NameError
app = FastAPI(title="ML Bot Engine + Multiplayer Server")
router = APIRouter(prefix="/api/chess")

# Wide CORS for development stability
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
BACKEND_URL = os.environ.get("BACKEND_URL", "http://host.docker.internal:8080")
MODEL_DIR = os.environ.get("MODEL_DIR", ".")

print(f"🚀 ML Bot Engine + Multiplayer Server starting...")

# =========================================================
# ML MODEL LOADING & INFERENCE HELPERS (ONNX Runtime)
# =========================================================
onnx_session = None  # ONNX inference session
onnx_input_name = None
onnx_output_name = None

# --- Smart Fallback Evaluator ---
PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 20000
}

def evaluate_board_material(board: chess.Board):
    """Simple heuristic if ML fails: count material balance"""
    score = 0
    for sq in chess.SQUARES:
        piece = board.piece_at(sq)
        if piece:
            val = PIECE_VALUES.get(piece.piece_type, 0)
            score += val if piece.color == chess.WHITE else -val
    
    # Slight bonus for mobility
    score += (board.legal_moves.count() * 10 if board.turn == chess.WHITE else -board.legal_moves.count() * 10)
    return score

def load_ml_model():
    global onnx_session, onnx_input_name, onnx_output_name
    try:
        onnx_path = os.path.join(MODEL_DIR, "model.onnx")
        
        if os.path.exists(onnx_path):
            logger.info(f"🔄 Loading ONNX model from {onnx_path}...")
            onnx_session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
            onnx_input_name = onnx_session.get_inputs()[0].name
            onnx_output_name = onnx_session.get_outputs()[0].name
            logger.info(f"✅ ONNX Model loaded. Input: {onnx_input_name}, Output: {onnx_output_name}")
        else:
            logger.info(f"ℹ️ No model.onnx at {onnx_path}. Using smart fallback evaluator.")
    except Exception as e:
        logger.error(f"❌ Error loading ONNX model: {e}. Using smart fallback.")
        onnx_session = None

# Run loading
load_ml_model()

def encode_board(board):
    encoded = np.zeros((8, 8, 13), dtype=np.float32)
    piece_map = board.piece_map()
    for square, piece in piece_map.items():
        row = 7 - (square // 8)
        col = square % 8
        channel = (piece.piece_type - 1)
        if piece.color == chess.BLACK:
            channel += 6
        encoded[row, col, channel] = 1.0
    encoded[:, :, 12] = 1.0 if board.turn == chess.WHITE else 0.0
    return encoded

# =========================================================
# MULTIPLAYER GAME ROOM MANAGER
# =========================================================

class GameRoom:
    def __init__(self, game_id: str, white: str, time_minutes: int, increment: int):
        self.game_id = game_id
        self.board = chess.Board()
        self.white: str = white
        self.black: Optional[str] = None
        self.white_elo = 800
        self.black_elo = 800
        self.time_minutes = time_minutes
        self.increment = increment
        self.white_time: float = time_minutes * 60.0
        self.black_time: float = time_minutes * 60.0
        self.started = False
        self.finished = False
        self.result: Optional[int] = None  # 1=white wins, -1=black wins, 0=draw
        self.result_type: Optional[str] = None
        self.moves: List[str] = []
        self.last_move_time: float = time.time()
        self.websockets: Dict[str, WebSocket] = {}  # username -> ws
        self.created_at = time.time()

    def to_state(self, for_user: Optional[str] = None) -> dict:
        color = None
        if for_user:
            if for_user == self.white:
                color = "white"
            elif for_user == self.black:
                color = "black"
        
        return {
            "type": "game_state",
            "gameId": self.game_id,
            "fen": self.board.fen(),
            "moves": self.moves,
            "turn": "white" if self.board.turn == chess.WHITE else "black",
            "whiteTime": self.white_time,
            "blackTime": self.black_time,
            "started": self.started,
            "finished": self.finished,
            "result": self.result,
            "resultType": self.result_type,
            "white": self.white,
            "black": self.black,
            "whiteElo": self.white_elo,
            "blackElo": self.black_elo,
            "timeControl": f"{self.time_minutes}+{self.increment}",
            "color": color,
            "legalMoves": [move.uci() for move in self.board.legal_moves],
        }
    
    def update_clock(self):
        """Deduct time from the active player's clock"""
        if not self.started or self.finished:
            return
        now = time.time()
        elapsed = now - self.last_move_time
        if self.board.turn == chess.WHITE:
            self.white_time = max(0, self.white_time - elapsed)
            if self.white_time <= 0:
                self.finished = True
                self.result = -1
                self.result_type = "timeout"
        else:
            self.black_time = max(0, self.black_time - elapsed)
            if self.black_time <= 0:
                self.finished = True
                self.result = 1
                self.result_type = "timeout"
        self.last_move_time = now

    def make_move(self, uci_str: str, username: str) -> bool:
        """Validate and apply a move. Returns True if successful."""
        if self.finished or not self.started:
            return False
        
        # Check it's the right player's turn
        expected = self.white if self.board.turn == chess.WHITE else self.black
        if username != expected:
            return False
        
        try:
            move = chess.Move.from_uci(uci_str)
            if move not in self.board.legal_moves:
                return False
        except ValueError:
            return False
        
        # Update clock before the move
        self.update_clock()
        if self.finished:
            return False
        
        # Apply the move
        self.board.push(move)
        self.moves.append(uci_str)
        
        # Add increment
        if self.board.turn == chess.BLACK:  # White just moved
            self.white_time += self.increment
        else:
            self.black_time += self.increment
        
        self.last_move_time = time.time()
        
        # Check for game over
        if self.board.is_checkmate():
            self.finished = True
            self.result = -1 if self.board.turn == chess.WHITE else 1
            self.result_type = "checkmate"
        elif self.board.is_stalemate() or self.board.is_insufficient_material() or \
             self.board.can_claim_draw() or self.board.is_fifty_moves():
            self.finished = True
            self.result = 0
            self.result_type = "draw"
        
        return True

    def resign(self, username: str):
        if self.finished:
            return
        self.finished = True
        if username == self.white:
            self.result = -1
        else:
            self.result = 1
        self.result_type = "resign"

    def accept_draw(self):
        if self.finished:
            return
        self.finished = True
        self.result = 0
        self.result_type = "draw"


# In-memory stores
game_rooms: Dict[str, GameRoom] = {}
matchmaking_queue: List[dict] = []  # [{username, time_minutes, increment, timestamp}]
matched_players: Dict[str, str] = {}  # username -> gameId (pending pickup)
chat_websockets: Dict[str, WebSocket] = {}  # username -> ws for DM chat


async def broadcast_game_state(room: GameRoom):
    """Send updated game state to all connected players"""
    disconnected = []
    for username, ws in room.websockets.items():
        try:
            state = room.to_state(for_user=username)
            state["type"] = "move"  # Signal it's a move update
            await ws.send_json(state)
        except Exception:
            disconnected.append(username)
    for u in disconnected:
        room.websockets.pop(u, None)


async def save_game_result(room: GameRoom):
    """POST game result to Spring Boot backend for persistence"""
    if not room.white or not room.black:
        return
    try:
        # Build a simple PGN
        pgn_moves = []
        board = chess.Board()
        for i, uci in enumerate(room.moves):
            move = chess.Move.from_uci(uci)
            san = board.san(move)
            board.push(move)
            if i % 2 == 0:
                pgn_moves.append(f"{i//2 + 1}. {san}")
            else:
                pgn_moves[-1] += f" {san}"
        
        pgn_str = " ".join(pgn_moves)
        result_str = "1-0" if room.result == 1 else "0-1" if room.result == -1 else "1/2-1/2"
        pgn_str += f" {result_str}"

        payload = {
            "gameId": room.game_id,
            "white": room.white,
            "black": room.black,
            "resultat": room.result or 0,
            "resultType": room.result_type or "unknown",
            "pgn": pgn_str,
            "timeControl": f"{room.time_minutes}+{room.increment}",
            "totalMoves": len(room.moves),
        }
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{BACKEND_URL}/api/online-parties/save", json=payload)
            print(f"💾 Game result saved: {resp.status_code}")
    except Exception as e:
        print(f"⚠️ Failed to save game result: {e}")


# =========================================================
# API ENDPOINTS - Health
# =========================================================

@app.get("/health")
def health():
    model_loaded = onnx_session is not None
    return {"status": "ok", "engine": "ml_bot", "model_loaded": model_loaded,
            "mode": "onnx" if model_loaded else "smart_fallback",
            "active_games": len(game_rooms), "matchmaking_queue": len(matchmaking_queue)}

@router.get("/health")
def api_health():
    return {"status": "ok", "engine": "ml_bot"}


# =========================================================
# API ENDPOINTS - ML Bot Inference
# =========================================================

@router.get("/custom-bot")
async def get_custom_bot_move(moves: str = "", color: str = "black"):
    try:
        board = chess.Board()
        if moves:
            for m in moves.split():
                if m.strip(): 
                    try: board.push_uci(m)
                    except: pass
        
        legal_moves = list(board.legal_moves)
        if not legal_moves:
            return {"bestmove": ""}

        # Determine if we should use ML or Fallback
        if onnx_session is None:
            # Smart Fallback using Minimax-lite (Material only)
            best_m = None
            best_s = float('-inf') if board.turn == chess.WHITE else float('inf')
            
            for m in legal_moves:
                board.push(m)
                score = evaluate_board_material(board)
                board.pop()
                
                if board.turn == chess.WHITE:
                    if score > best_s:
                        best_s = score
                        best_m = m
                else:
                    if score < best_s:
                        best_s = score
                        best_m = m
            
            logger.info(f"🧠 Smart Fallback bot chose {best_m} (material: {best_s})")
            return {"bestmove": best_m.uci() if best_m else "", "mode": "smart_fallback"}

        # ONNX Inference
        encoded_boards = []
        for m in legal_moves:
            board.push(m)
            encoded_boards.append(encode_board(board))
            board.pop()

        input_array = np.array(encoded_boards, dtype=np.float32)
        predictions = onnx_session.run([onnx_output_name], {onnx_input_name: input_array})[0]
        
        best_m = None
        if color == "white":
            best_s = float('-inf')
            for i, m in enumerate(legal_moves):
                score = float(predictions[i][0])
                if score > best_s:
                    best_s = score
                    best_m = m
        else:
            best_s = float('inf')
            for i, m in enumerate(legal_moves):
                score = float(predictions[i][0])
                if score < best_s:
                    best_s = score
                    best_m = m
        
        logger.info(f"🤖 ONNX Bot ({color}) chose {best_m} with score {best_s:.4f}")
        return {"bestmove": best_m.uci() if best_m else "", "mode": "onnx"}
        
    except Exception as e:
        logger.error(f"❌ Inference error: {e}")
        import random
        # Last resort random
        legal = list(chess.Board().legal_moves) # Using fresh board if current failed
        move = random.choice(legal) if legal else None
        return {"bestmove": move.uci() if move else "", "fallback": "random", "error": str(e)}
async def get_player_elo(username: str) -> int:
    """Fetch player ELO from the backend REST API"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BACKEND_URL}/api/joueurs/search", params={"pseudo": username}, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("elo", 800)
    except Exception as e:
        logger.error(f"Failed to fetch ELO for {username}: {e}")
    return 800


# =========================================================
# API ENDPOINTS - Multiplayer REST
# =========================================================

class CreateGameRequest(BaseModel):
    username: str
    timeMinutes: int = 5
    increment: int = 0

class JoinGameRequest(BaseModel):
    username: str

class MatchmakingRequest(BaseModel):
    username: str
    timeMinutes: int = 5
    increment: int = 0

class CancelMatchmakingRequest(BaseModel):
    username: str


@router.post("/multiplayer/create")
async def create_game(req: CreateGameRequest):
    game_id = uuid.uuid4().hex[:8]
    room = GameRoom(game_id, req.username, req.timeMinutes, req.increment)
    room.white_elo = await get_player_elo(req.username)
    game_rooms[game_id] = room
    print(f"🎮 Game created: {game_id} by {req.username} ({req.timeMinutes}+{req.increment}) [ELO: {room.white_elo}]")
    return {"gameId": game_id, "white": req.username, "status": "waiting"}


@router.post("/multiplayer/join/{game_id}")
async def join_game(game_id: str, req: JoinGameRequest):
    room = game_rooms.get(game_id)
    if not room:
        raise HTTPException(status_code=404, detail="Game not found")
    if room.started:
        raise HTTPException(status_code=400, detail="Game already started")
    if room.black is not None:
        raise HTTPException(status_code=400, detail="Game is full")
    if room.white == req.username:
        raise HTTPException(status_code=400, detail="Cannot join your own game")
    
    room.black = req.username
    room.black_elo = await get_player_elo(req.username)
    room.started = True
    room.last_move_time = time.time()
    print(f"🎮 {req.username} joined game {game_id}. Game started! [ELO: {room.black_elo}]")

    # Notify connected WebSocket clients that game has started
    asyncio.create_task(broadcast_game_start(room))

    return {"gameId": game_id, "white": room.white, "black": room.black, "status": "started"}


async def broadcast_game_start(room: GameRoom):
    """Notify all connected players that the game has started"""
    for username, ws in room.websockets.items():
        try:
            state = room.to_state(for_user=username)
            state["type"] = "game_start"
            await ws.send_json(state)
        except Exception:
            pass


@router.post("/multiplayer/matchmaking")
async def join_matchmaking(req: MatchmakingRequest):
    # Remove prior entries from this user
    matchmaking_queue[:] = [e for e in matchmaking_queue if e["username"] != req.username]
    matched_players.pop(req.username, None)

    # Try to find a match with same time control
    for i, entry in enumerate(matchmaking_queue):
        if entry["timeMinutes"] == req.timeMinutes and entry["increment"] == req.increment:
            # Match found!
            opponent = entry["username"]
            matchmaking_queue.pop(i)
            
            game_id = uuid.uuid4().hex[:8]
            room = GameRoom(game_id, opponent, req.timeMinutes, req.increment)
            room.white_elo = await get_player_elo(opponent)
            room.black_elo = await get_player_elo(req.username)
            room.black = req.username
            room.started = True
            room.last_move_time = time.time()
            game_rooms[game_id] = room

            # Store for the opponent to pick up via check-match
            matched_players[opponent] = game_id
            
            print(f"🎯 Matchmaking: {opponent} vs {req.username} → {game_id}")
            return {"matched": True, "gameId": game_id, "opponent": opponent}

    # No match found, add to queue
    matchmaking_queue.append({
        "username": req.username,
        "timeMinutes": req.timeMinutes,
        "increment": req.increment,
        "timestamp": time.time(),
    })
    print(f"⏳ {req.username} added to matchmaking queue ({req.timeMinutes}+{req.increment})")
    return {"matched": False, "message": "Waiting for opponent"}


@router.post("/multiplayer/cancel-matchmaking")
async def cancel_matchmaking(req: CancelMatchmakingRequest):
    matchmaking_queue[:] = [e for e in matchmaking_queue if e["username"] != req.username]
    matched_players.pop(req.username, None)
    print(f"❌ {req.username} cancelled matchmaking")
    return {"message": "Matchmaking cancelled"}


@router.get("/multiplayer/check-match")
async def check_match(username: str):
    game_id = matched_players.pop(username, None)
    if game_id and game_id in game_rooms:
        return {"matched": True, "gameId": game_id}
    return {"matched": False}


@router.get("/multiplayer/status/{game_id}")
async def get_game_status(game_id: str):
    room = game_rooms.get(game_id)
    if not room:
        raise HTTPException(status_code=404, detail="Game not found")
    room.update_clock()
    return room.to_state()


# =========================================================
# WEBSOCKET - Game (moves, resign, draw, chat-in-game)
# =========================================================

@app.websocket("/api/chess/ws/game/{game_id}")
async def game_websocket(websocket: WebSocket, game_id: str):
    await websocket.accept()
    
    room = game_rooms.get(game_id)
    if not room:
        await websocket.send_json({"type": "error", "message": "Game not found"})
        await websocket.close()
        return

    username = None
    try:
        # First message should identify the player
        data = await websocket.receive_json()
        username = data.get("username", "")
        
        if not username:
            await websocket.send_json({"type": "error", "message": "Username required"})
            await websocket.close()
            return

        # Register this WebSocket
        room.websockets[username] = websocket
        print(f"🔌 WS: {username} connected to game {game_id}")

        # Send initial game state
        state = room.to_state(for_user=username)
        await websocket.send_json(state)

        # Notify other players
        for other_user, other_ws in room.websockets.items():
            if other_user != username:
                try:
                    await other_ws.send_json({
                        "type": "player_connected",
                        "username": username
                    })
                except Exception:
                    pass

        # If both players joined via REST but hadn't gotten the start signal via WS
        if room.started and room.white and room.black:
            for u, ws in room.websockets.items():
                try:
                    s = room.to_state(for_user=u)
                    s["type"] = "game_start"
                    await ws.send_json(s)
                except Exception:
                    pass

        # Listen for messages
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "move":
                uci = data.get("uci", "")
                success = room.make_move(uci, username)
                if success:
                    # Broadcast updated state
                    for u, ws in room.websockets.items():
                        try:
                            s = room.to_state(for_user=u)
                            s["type"] = "game_over" if room.finished else "move"
                            await ws.send_json(s)
                        except Exception:
                            pass
                    
                    if room.finished:
                        asyncio.create_task(save_game_result(room))
                else:
                    await websocket.send_json({"type": "error", "message": "Invalid move"})

            elif msg_type == "resign":
                room.resign(username)
                for u, ws in room.websockets.items():
                    try:
                        s = room.to_state(for_user=u)
                        s["type"] = "game_over"
                        await ws.send_json(s)
                    except Exception:
                        pass
                asyncio.create_task(save_game_result(room))

            elif msg_type == "offer_draw":
                # Notify opponent
                for u, ws in room.websockets.items():
                    if u != username:
                        try:
                            await ws.send_json({"type": "draw_offer", "from": username})
                        except Exception:
                            pass

            elif msg_type == "accept_draw":
                room.accept_draw()
                for u, ws in room.websockets.items():
                    try:
                        s = room.to_state(for_user=u)
                        s["type"] = "game_over"
                        await ws.send_json(s)
                    except Exception:
                        pass
                asyncio.create_task(save_game_result(room))

            elif msg_type == "chat":
                content = data.get("content", "")
                if content:
                    for u, ws in room.websockets.items():
                        if u != username:
                            try:
                                await ws.send_json({
                                    "type": "chat",
                                    "from": username,
                                    "content": content,
                                    "timestamp": int(time.time() * 1000)
                                })
                            except Exception:
                                pass

    except WebSocketDisconnect:
        print(f"🔌 WS: {username} disconnected from game {game_id}")
    except Exception as e:
        print(f"🔌 WS error for {username} in game {game_id}: {e}")
    finally:
        if username and room:
            room.websockets.pop(username, None)
            # If game was in progress and a player disconnects, opponent wins
            if room.started and not room.finished and username in (room.white, room.black):
                room.finished = True
                room.result = -1 if username == room.white else 1
                room.result_type = "disconnect"
                # Notify remaining players
                for u, ws in room.websockets.items():
                    try:
                        s = room.to_state(for_user=u)
                        s["type"] = "game_over"
                        await ws.send_json(s)
                    except Exception:
                        pass
                asyncio.create_task(save_game_result(room))


# =========================================================
# WEBSOCKET - Direct Message Chat (Friends page)
# =========================================================

@app.websocket("/api/chess/ws/chat")
async def chat_websocket(websocket: WebSocket):
    await websocket.accept()
    username = None
    try:
        # First message identifies the user
        data = await websocket.receive_json()
        username = data.get("username", "")
        if not username:
            await websocket.close()
            return
        
        chat_websockets[username] = websocket
        print(f"💬 Chat WS: {username} connected")

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")
            
            if msg_type == "dm":
                to_user = data.get("to", "")
                content = data.get("content", "")
                if to_user and content:
                    target_ws = chat_websockets.get(to_user)
                    if target_ws:
                        try:
                            await target_ws.send_json({
                                "type": "dm",
                                "from": username,
                                "content": content,
                                "timestamp": int(time.time() * 1000)
                            })
                        except Exception:
                            pass

            elif msg_type == "challenge":
                # Challenger sends: { type: "challenge", to: "friendPseudo", gameId: "xxx", timeControl: "5+0", mode: "2d"|"3d" }
                to_user = data.get("to", "")
                game_id = data.get("gameId", "")
                time_control = data.get("timeControl", "")
                mode = data.get("mode", "2d")
                if to_user and game_id:
                    target_ws = chat_websockets.get(to_user)
                    if target_ws:
                        try:
                            await target_ws.send_json({
                                "type": "challenge",
                                "from": username,
                                "gameId": game_id,
                                "timeControl": time_control,
                                "mode": mode,
                                "timestamp": int(time.time() * 1000)
                            })
                        except Exception:
                            pass
                    else:
                        # Friend is offline – relay back to challenger
                        await websocket.send_json({
                            "type": "challenge_offline",
                            "to": to_user,
                            "gameId": game_id
                        })

            elif msg_type == "challenge_response":
                # Challenged player says accept/decline: { type: "challenge_response", to: "challengerPseudo", gameId: "xxx", accepted: true/false, mode: "2d"|"3d" }
                to_user = data.get("to", "")
                game_id = data.get("gameId", "")
                accepted = data.get("accepted", False)
                mode = data.get("mode", "2d")
                if to_user:
                    target_ws = chat_websockets.get(to_user)
                    if target_ws:
                        try:
                            await target_ws.send_json({
                                "type": "challenge_response",
                                "from": username,
                                "gameId": game_id,
                                "accepted": accepted,
                                "mode": mode,
                                "timestamp": int(time.time() * 1000)
                            })
                        except Exception:
                            pass

    except WebSocketDisconnect:
        print(f"💬 Chat WS: {username} disconnected")
    except Exception as e:
        print(f"💬 Chat WS error for {username}: {e}")
    finally:
        if username:
            chat_websockets.pop(username, None)


# =========================================================
# PERIODIC CLEANUP (stale games, old matchmaking entries)
# =========================================================

@app.on_event("startup")
async def startup_cleanup_task():
    async def cleanup():
        while True:
            await asyncio.sleep(5)  # Check more frequently for timeouts
            now = time.time()
            
            # 1. Check for timeouts in active games
            for gid, room in list(game_rooms.items()):
                if room.started and not room.finished:
                    room.update_clock()
                    if room.finished:
                        # Broadcast game over
                        print(f"⏰ Game {gid} timed out!")
                        for u, ws in room.websockets.items():
                            try:
                                await ws.send_json(room.to_state(for_user=u))
                            except: pass
                        asyncio.create_task(save_game_result(room))

            # 2. Remove stale matchmaking entries (older than 5 minutes)
            matchmaking_queue[:] = [
                e for e in matchmaking_queue if now - e["timestamp"] < 300
            ]
            
            # 3. Remove finished games older than 30 minutes
            stale_ids = [
                gid for gid, room in game_rooms.items()
                if room.finished and now - room.created_at > 1800
            ]
            for gid in stale_ids:
                game_rooms.pop(gid, None)
            
            # 4. Remove games that were never started and are older than 10 minutes
            abandoned_ids = [
                gid for gid, room in game_rooms.items()
                if not room.started and now - room.created_at > 600
            ]
            for gid in abandoned_ids:
                game_rooms.pop(gid, None)

    asyncio.create_task(cleanup())


app.include_router(router)
