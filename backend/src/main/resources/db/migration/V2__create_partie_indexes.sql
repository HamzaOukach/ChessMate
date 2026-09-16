-- Index sur le joueur blanc
CREATE INDEX IF NOT EXISTS idx_partie_joueur_blanc
ON partie(id_joueur_blanc);

-- Index sur le joueur noir
CREATE INDEX IF NOT EXISTS idx_partie_joueur_noir
ON partie(id_joueur_noir);

-- Index sur la date de la partie (utile pour filtrer par date)
CREATE INDEX IF NOT EXISTS idx_partie_date_heure
ON partie(date_heure_utc);

-- Index sur le résultat (utile pour calculer taux de victoire)
CREATE INDEX IF NOT EXISTS idx_partie_resultat
ON partie(resultat);

-- Index sur l'ouverture (utile pour stats sur les ouvertures)
CREATE INDEX IF NOT EXISTS idx_partie_ouverture
ON partie(id_ouverture);