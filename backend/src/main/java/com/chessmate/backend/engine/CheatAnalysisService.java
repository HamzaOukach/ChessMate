package com.chessmate.backend.engine;

import com.chessmate.backend.entiter.Partie;
import org.springframework.stereotype.Service;

@Service
public class CheatAnalysisService {

    private final StockfishEngineService engine;

    public CheatAnalysisService(StockfishEngineService engine) {
        this.engine = engine;
    }

    public CheatResult analyze(Partie partie) throws Exception {

        // TODO (étape suivante)
        // 1. Parser le PGN
        // 2. Pour chaque coup :
        //    - eval meilleur coup
        //    - eval coup joué
        // 3. Calculer ACPL + Top1%
        // 4. Retourner résultat

        return new CheatResult(12.4, 82.3, 7, Verdict.HIGH);
    }
}