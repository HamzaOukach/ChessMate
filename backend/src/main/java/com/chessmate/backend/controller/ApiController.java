package com.chessmate.backend.controller;

import com.chessmate.backend.service.IApi;
import com.chessmate.backend.service.api.Lichess;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final IApi api;

    public ApiController(Lichess api) {
        this.api = api;
    }

    @GetMapping
    public String index() {
        return "Chessmate";
    }

    @GetMapping("/partie/{id}")
    public String partie(@PathVariable String id) throws IOException, InterruptedException {
        return api.findPartieParId(id);
    }

    @GetMapping("/parties/{pseudo}")
    public String parties(
            @PathVariable("pseudo") String pseudo,
            @RequestParam(value = "debut", required = false) Integer debut,
            @RequestParam(value = "fin", required = false) Integer fin,
            @RequestParam(value = "max", required = false) Integer max
    ) throws IOException, InterruptedException {
        return api.findPartiesParPseudo(pseudo, debut, fin, max);
    }

    @GetMapping("/fide")
    public String fide(@RequestParam("recherche") String recherche) throws IOException, InterruptedException {
        return api.findJoueursFIDE(recherche);
    }
}
