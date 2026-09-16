package com.chessmate.backend.service.api;

import com.chessmate.backend.service.IApi;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;

@Service
public class Lichess implements IApi {

    /**
     * Lien vers l'API de Lichess
     */
    public static final String API_URI = "https://lichess.org/";

    /** Client HTTP pour requêter l'API */
    private HttpClient client;

    public Lichess() {
        client = HttpClient.newHttpClient();
    }

    private HttpRequest getRequest(String route) {
        return HttpRequest.newBuilder(URI.create(API_URI + route)).build();
    }

    private String getResponse(String route) throws IOException, InterruptedException {
        HttpResponse<String> response = client.send(getRequest(route), HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() == 200) {
            return response.body();
        }

        return null;
    }

    @Override
    public String findPartieParId(String id) throws IOException, InterruptedException {
        if (id != null) {
            return getResponse("game/export/" + id);
        }

        return null;
    }

    @Override
    public String findPartiesParPseudo(String pseudo, Integer debut, Integer fin, Integer max) throws IOException, InterruptedException {
        if (pseudo != null) {
            String route = "api/games/user/" + pseudo;
            List<String> parametres = new ArrayList<>();

            if (debut != null) {
                parametres.add("since=" + debut);
            }
            if (fin != null) {
                parametres.add("until=" + fin);
            }
            if (max != null) {
                parametres.add("max=" + max);
            }

            if (!parametres.isEmpty()) {
                route += "?" + String.join("&", parametres);
            }

            return getResponse(route);
        }

        return null;
    }

    @Override
    public String findJoueursFIDE(String rechercheNom) throws IOException, InterruptedException {
        if (rechercheNom != null) {
            return getResponse("api/fide/player?q=" + rechercheNom);
        }

        return null;
    }
}
