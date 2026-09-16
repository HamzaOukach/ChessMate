package com.chessmate.backend.service;

import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;

import com.chessmate.backend.dto.Analyseur;
import com.chessmate.backend.cheat.engine.EngineEvaluation;
import com.chessmate.backend.cheat.engine.EngineMoveAnalysis;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import java.io.*;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@Scope("prototype") // Un processus Stockfish par instance de thread
public class StockfishWrapper {

    private Process process;
    private BufferedWriter writer;
    private BufferedReader reader;
    private static final long COMMAND_TIMEOUT_MS = 10000; // Increased timeout for deep analysis

    // Get Stockfish path - tries multiple locations
    private String getStockfishPath() throws Exception {
        String os = System.getProperty("os.name").toLowerCase();
        boolean isLinux = os.contains("linux");
        
        // Try 1: Check if stockfish is in system PATH
        try {
            String[] cmd = isLinux ? new String[]{"sh", "-c", "which stockfish"} : new String[]{"cmd", "/c", "where stockfish"};
            ProcessBuilder pb = new ProcessBuilder(cmd);
            Process p = pb.start();
            BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
            String line = br.readLine();
            if (line != null && !line.isEmpty()) {
                System.out.println(">>> Found Stockfish in PATH: " + line);
                return line.trim();
            }
        } catch (Exception e) {
            System.err.println("Could not find stockfish in PATH: " + e.getMessage());
        }
        
        // Try 2: /app directory (Docker container Linux)
        if (isLinux) {
            String dockerPath = "/usr/games/stockfish";
            if (Files.exists(Paths.get(dockerPath))) {
                System.out.println(">>> Found Stockfish at: " + dockerPath);
                return dockerPath;
            }
            
            String dockerPath2 = "/usr/bin/stockfish";
            if (Files.exists(Paths.get(dockerPath2))) {
                System.out.println(">>> Found Stockfish at: " + dockerPath2);
                return dockerPath2;
            }
        }
        
        // Try 3: Windows local exe
        String currentDir = System.getProperty("user.dir");
        String devPath = currentDir + File.separator + "src" + File.separator + "main" + File.separator + 
                        "java" + File.separator + "com" + File.separator + "chessmate" + File.separator + 
                        "backend" + File.separator + "service" + File.separator + "stockfish-windows-x86-64-avx2.exe";
        
        if (Files.exists(Paths.get(devPath)) && !isLinux) {
            System.out.println(">>> Found Stockfish at: " + devPath);
            return devPath;
        }
        
        throw new FileNotFoundException("Stockfish executable not found. OS: " + os + ". Tried PATH, /usr/games/stockfish, /usr/bin/stockfish, and dev paths");
    }

    private int depth = 15;
    private int movetime = 1000;
    private boolean isAvailable = false;

    @PostConstruct
    public void start() {
        try {
            String stockfishPath = getStockfishPath();
            System.out.println(">>> Tentative de démarrage de Stockfish depuis: " + stockfishPath);
            
            ProcessBuilder builder = new ProcessBuilder(stockfishPath);
            builder.redirectErrorStream(true);

            process = builder.start();
            writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream()));
            reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            

            // Initialize UCI
            sendCommand("uci");
            waitFor("uciok", 3000);

            // OPTIMISATION PAR DÉFAUT POUR LES WORKERS
            // On limite à 1 thread pour permettre le parallélisme de RabbitMQ sans saturer le CPU
            sendCommand("setoption name Threads value 1");
            sendCommand("setoption name Hash value 64");

            // Verify engine is ready
            sendCommand("isready");
            waitFor("readyok", 3000);

            isAvailable = true;
            System.out.println(">>> Stockfish est prêt et en cours d'exécution!");
        } catch (Exception e) {
            System.err.println("ERREUR: Impossible de démarrer Stockfish. " + e.getMessage());
            isAvailable = false;
        }
    }

    public void reset() {
        try {
            sendCommand("ucinewgame");
            sendCommand("isready");
            waitFor("readyok", 1000);
        } catch (IOException e) {
            System.err.println("Error resetting Stockfish: " + e.getMessage());
        }
    }

    public void setDepth(int depth) {
        this.depth = depth;
    }

    public void setMovetime(int movetime) {
        this.movetime = movetime;
    }

    public synchronized String getBestMove(String moves, String mode) {
        if (!isAvailable || process == null || !process.isAlive()) {
            return "e2e4";
        }
        
        try {
            String positionCmd = (moves == null || moves.isBlank())
                ? "position startpos" 
                : "position startpos moves " + moves;
            
            sendCommand(positionCmd);
            
            String goCommand;
            if ("depth".equalsIgnoreCase(mode)) {
                goCommand = "go depth " + this.depth;
            } else if ("movetime".equalsIgnoreCase(mode)) {
                goCommand = "go movetime " + this.movetime;
            } else {
                goCommand = "go movetime 1000";
            }
            
            sendCommand(goCommand);

            long startTime = System.currentTimeMillis();
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("bestmove")) {
                    String[] parts = line.split("\\s+");
                    return (parts.length > 1) ? parts[1] : "e2e4";
                }
                
                if (System.currentTimeMillis() - startTime > COMMAND_TIMEOUT_MS) {
                    return "e2e4";
                }
            }
        } catch (Exception e) {
            System.err.println("Erreur Stockfish (getBestMove): " + e.getMessage());
        }
        return "e2e4";
    }

    public synchronized EngineMoveAnalysis analyzeFen(String fen, int depth, int topN) {
        if (!isAvailable || process == null || !process.isAlive()) {
            return new EngineMoveAnalysis("e2e4", List.of("e2e4"));
        }

        try {
            int n = Math.max(1, topN);

            sendCommand("setoption name MultiPV value " + n);
            sendCommand("isready");
            waitFor("readyok", 1500);

            String posCmd = fen.trim().startsWith("startpos") ? "position " + fen : "position fen " + fen;
            sendCommand(posCmd);
            sendCommand("go depth " + Math.max(1, depth));

            Map<Integer, String> multipvMoves = new LinkedHashMap<>();
            String best = null;

            long startTime = System.currentTimeMillis();
            String line;

            while ((line = reader.readLine()) != null) {
                if (line.startsWith("info") && line.contains(" pv ") && line.contains(" multipv ")) {
                    int multipvIdx = line.indexOf(" multipv ");
                    int pvIdx = line.indexOf(" pv ");
                    if (multipvIdx >= 0 && pvIdx >= 0) {
                        try {
                            String afterMultipv = line.substring(multipvIdx + 9).trim();
                            int rank = Integer.parseInt(afterMultipv.split("\\s+")[0]);
                            String pv = line.substring(pvIdx + 4).trim();
                            String[] pvParts = pv.split("\\s+");
                            if (pvParts.length > 0 && !pvParts[0].isEmpty()) {
                                multipvMoves.put(rank, pvParts[0].trim());
                            }
                        } catch (NumberFormatException ignored) {
                        }
                    }
                }

                if (line.startsWith("bestmove")) {
                    String[] parts = line.split("\\s+");
                    if (parts.length > 1) best = parts[1];
                    break;
                }

                if (System.currentTimeMillis() - startTime > COMMAND_TIMEOUT_MS) break;
            }

            List<String> list = new ArrayList<>();
            for (int i = 1; i <= n; i++) {
                String move = multipvMoves.get(i);
                if (move != null) list.add(move);
            }

            if (best == null) best = list.isEmpty() ? "e2e4" : list.get(0);
            if (list.isEmpty()) list = List.of(best);

            return new EngineMoveAnalysis(best, list);

        } catch (Exception e) {
            return new EngineMoveAnalysis("e2e4", List.of("e2e4"));
        }
    }

    public synchronized EngineEvaluation evaluateFen(String fen, int depth) {
        if (!isAvailable || process == null || !process.isAlive()) {
            return new EngineEvaluation("0000", 0, false);
        }

        try {
            String posCmd = fen.trim().startsWith("startpos") ? "position " + fen : "position fen " + fen;
            sendCommand(posCmd);
            sendCommand("go depth " + depth);

            Integer lastCp = 0;
            boolean mate = false;
            String bestMove = "0000";

            long startTime = System.currentTimeMillis();
            String line;

            while ((line = reader.readLine()) != null) {
                if (line.startsWith("info") && line.contains(" score ")) {
                    String[] parts = line.split("\\s+");
                    for (int i = 0; i < parts.length - 2; i++) {
                        if ("score".equals(parts[i])) {
                            if ("cp".equals(parts[i + 1])) {
                                lastCp = Integer.parseInt(parts[i + 2]);
                                mate = false;
                            } else if ("mate".equals(parts[i + 1])) {
                                int mateValue = Integer.parseInt(parts[i + 2]);
                                lastCp = mateValue > 0 ? 100000 : -100000;
                                mate = true;
                            }
                        }
                    }
                }

                if (line.startsWith("bestmove")) {
                    String[] parts = line.split("\\s+");
                    if (parts.length > 1) bestMove = parts[1];
                    break;
                }

                if (System.currentTimeMillis() - startTime > COMMAND_TIMEOUT_MS) break;
            }

            return new EngineEvaluation(bestMove, lastCp, mate);

        } catch (Exception e) {
            return new EngineEvaluation("0000", 0, false);
        }
    }

    // New analysis method from frontend branch
    public Analyseur analyzePosition(String moves, int targetDepth) {
        try {
            String positionCmd = (moves == null || moves.isBlank())
                    ? "position startpos"
                    : "position startpos moves " + moves;

            sendCommand(positionCmd);
            sendCommand("go depth " + targetDepth);

            String line;
            int eval = 0;
            String bestMove = null;

            long startTime = System.currentTimeMillis();
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("info") && line.contains("score cp")) {
                    String[] parts = line.split("\\s+");
                    for (int i = 0; i < parts.length - 1; i++) {
                        if (parts[i].equals("cp")) {
                            eval = Integer.parseInt(parts[i + 1]);
                        }
                        if (parts[i].equals("pv")) {
                            bestMove = parts[i + 1];
                            break;
                        }
                    }
                }
                if (line.startsWith("bestmove")) break;
                if (System.currentTimeMillis() - startTime > COMMAND_TIMEOUT_MS) break;
            }
            return new Analyseur(bestMove, eval);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return new Analyseur(null, 0);
    }

    private void sendCommand(String command) throws IOException {
        if (writer != null) {
            writer.write(command + "\n");
            writer.flush();
        }
    }

    private void waitFor(String expected, long timeoutMs) throws IOException {
        long startTime = System.currentTimeMillis();
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.contains(expected)) break;
            if (System.currentTimeMillis() - startTime > timeoutMs) break;
        }
    }

    @PreDestroy
    public void stop() {
        try {
            if (writer != null) sendCommand("quit");
            if (process != null) {
                process.waitFor(2, java.util.concurrent.TimeUnit.SECONDS);
                if (process.isAlive()) process.destroy();
            }
        } catch (Exception e) {
            System.err.println("Error stopping Stockfish: " + e.getMessage());
        }
    }
}
