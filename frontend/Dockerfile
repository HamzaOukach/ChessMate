# Étape 1 : Build de l'application React avec Vite
FROM node:20-slim AS builder

WORKDIR /app

# Copier uniquement les fichiers nécessaires pour l'installation des dépendances
COPY package.json package-lock.json ./
RUN npm install

# Copier le reste du code source
COPY . .

# Définir l'URL de l'API passée au moment du build
ARG VITE_API_URL
ARG VITE_ML_API_URL
ARG VITE_STOCKFISH_API_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ML_API_URL=$VITE_ML_API_URL
ENV VITE_STOCKFISH_API_URL=$VITE_STOCKFISH_API_URL

# Générer les fichiers statiques de production dans /app/build
RUN npm run build

# Étape 2 : Servir les fichiers avec Nginx
FROM nginx:alpine

# Remplacer la configuration Nginx par défaut
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/

# Copier les fichiers statiques générés lors de l'étape 1
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
