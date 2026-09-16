package com.chessmate.backend.engine;

import org.springframework.stereotype.Service;

import java.io.*;

@Service
public class StockfishEngineService {

    private Process process;
    private BufferedWriter writer;
    private BufferedReader reader;

    public void start() throws IOException {
        ProcessBuilder pb = new ProcessBuilder("/usr/games/stockfish");
        process = pb.start();

        writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream()));
        reader = new BufferedReader(new InputStreamReader(process.getInputStream()));

        sendCommand("uci");
        waitFor("uciok");
        sendCommand("isready");
        waitFor("readyok");
    }

    public void sendCommand(String command) throws IOException {
        writer.write(command);
        writer.newLine();
        writer.flush();
    }

    public String readLine() throws IOException {
        return reader.readLine();
    }

    private void waitFor(String token) throws IOException {
        String line;
        while ((line = reader.readLine()) != null) {
            if (line.contains(token)) break;
        }
    }

    public void stop() throws IOException {
        sendCommand("quit");
        process.destroy();
    }
}