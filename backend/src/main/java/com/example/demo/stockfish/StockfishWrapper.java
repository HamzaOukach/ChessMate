package com.example.demo.stockfish;

import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

import java.io.*;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Paths;

@Component
public class StockfishWrapper {

    private Process process;
    private BufferedWriter writer;
    private BufferedReader reader;
    private static final long COMMAND_TIMEOUT_MS = 5000; // 5 second timeout

    // Get Stockfish path - tries multiple locations
    private String getStockfishPath() throws Exception {
        // Try 1: /app directory (Docker container)
        String dockerPath = "/app/stockfish-windows-x86-64-avx2.exe";
        if (Files.exists(Paths.get(dockerPath))) {
            return dockerPath;
        }
        
        // Try 2: same directory as this class (development)
        String currentDir = System.getProperty("user.dir");
        String devPath = currentDir + File.separator + "src" + File.separator + "main" + File.separator + 
                        "java" + File.separator + "com" + File.separator + "example" + File.separator + 
                        "demo" + File.separator + "stockfish" + File.separator + "stockfish-windows-x86-64-avx2.exe";
        
        if (Files.exists(Paths.get(devPath))) {
            return devPath;
        }
        
        // Try 3: JAR directory
        String jarDir = new File(StockfishWrapper.class.getProtectionDomain().getCodeSource().getLocation().toURI()).getParentFile().getAbsolutePath();
        String jarPath = jarDir + File.separator + "stockfish-windows-x86-64-avx2.exe";
        
        if (Files.exists(Paths.get(jarPath))) {
            return jarPath;
        }
        
        throw new FileNotFoundException("Stockfish executable not found. Tried: " + dockerPath + ", " + devPath + ", " + jarPath);
    }

    private int depth = 15;
    private int movetime = 1000; 

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

            // Verify engine is ready
            sendCommand("isready");
            waitFor("readyok", 3000);

            System.out.println(">>> Stockfish est prêt et en cours d'exécution!");
        } catch (Exception e) {
            System.err.println("ERREUR: Impossible de démarrer Stockfish. " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void setDepth(int depth) {
        this.depth = depth;
    }

    public void setMovetime(int movetime) {
        this.movetime = movetime;
    }

    public synchronized String getBestMove(String moves, String mode) {
        if (process == null || !process.isAlive()) {
            return "e2e4";
        }
        
        try {
            // Handle empty moves - starting position
            String positionCmd = moves == null || moves.isEmpty() 
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

            // Wait for bestmove with timeout
            long startTime = System.currentTimeMillis();
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("bestmove")) {
                    String[] parts = line.split(" ");
                    if (parts.length > 1) {
                        return parts[1];
                    }
                    break;
                }
                
                if (System.currentTimeMillis() - startTime > COMMAND_TIMEOUT_MS) {
                    System.err.println("Timeout waiting for Stockfish bestmove");
                    return "e2e4";
                }
            }
        } catch (Exception e) {
            System.err.println("Erreur Stockfish (getBestMove): " + e.getMessage());
            e.printStackTrace();
        }
        
        return "e2e4";
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
            if (line.contains(expected)) {
                break;
            }
            if (System.currentTimeMillis() - startTime > timeoutMs) {
                System.err.println("Timeout waiting for: " + expected);
                break;
            }
        }
    }

    @PreDestroy
    public void stop() {
        try {
            if (writer != null) {
                sendCommand("quit");
            }
            if (process != null) {
                process.waitFor(2, java.util.concurrent.TimeUnit.SECONDS);
                if (process.isAlive()) {
                    process.destroy();
                }
            }
        } catch (Exception e) {
            System.err.println("Error stopping Stockfish: " + e.getMessage());
        }
    }
}