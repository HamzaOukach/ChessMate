# Étape 1 : build du JAR
FROM maven:eclipse-temurin AS build
WORKDIR /app
COPY . .
#RUN mvn -q clean package -DskipTests
RUN mvn -q clean package -Dmaven.test.skip=true

# Étape 2 : runtime Java propre avec Stockfish et Python pour le profiling ML
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN apt-get update && \
    apt-get install -y docker.io curl python3 python3-pandas stockfish && \
    mkdir -p /usr/lib/docker/cli-plugins && \
    curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
    -o /usr/lib/docker/cli-plugins/docker-compose && \
    chmod +x /usr/lib/docker/cli-plugins/docker-compose && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /app/target/demo-0.0.1-SNAPSHOT.jar /app.jar
COPY ml_chess_profile.py /app/ml_chess_profile.py

# Créer un fichier baseline vide s'il n'existe pas pour éviter les crashs fatals du script
RUN echo "white_id,black_id,winner,victory_status,turns,opening_name,white_rating,black_rating" > /app/games_final_clean.csv && \
    echo "user1,user2,white,mate,40,Ruy Lopez,1500,1500" >> /app/games_final_clean.csv

EXPOSE 8080
CMD ["java", "-jar", "/app.jar"]