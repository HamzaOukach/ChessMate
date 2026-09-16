package com.chessmate.backend.cheat.detector;

import com.chessmate.backend.cheat.engine.EngineOracle;
import com.chessmate.backend.cheat.model.CheatSignal;
import com.chessmate.backend.cheat.model.GameData;

public interface CheatDetector {
    CheatSignal detect(GameData game, EngineOracle oracle);
}
