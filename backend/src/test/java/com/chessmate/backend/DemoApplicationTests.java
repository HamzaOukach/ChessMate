package com.chessmate.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "app.secret-key=test-secret",
        "app.expiration-time=3600000"    // 1 heure en millisecondes
})
class DemoApplicationTests {

    @Test
    void contextLoads() {
    }
}
