"""Parsing et hashing des parties PGN"""

import hashlib
import re
import chess


# Regex pré-compilées
_COMMENT_RE = re.compile(r"\{[^}]*}")
_NAG_RE = re.compile(r"\$\d+")
_BRACKET_TAG_RE = re.compile(r"\[%.*?]")


def clean_pgn_moves(pgn_moves: str) -> str:
    """
    Nettoie les coups PGN :
      - Supprime commentaires { ... }
      - Supprime NAGs ($1, $2, ...)
      - Supprime tags [%eval ...], [%clk ...]
    """
    if not pgn_moves:
        return ""

    s = pgn_moves
    s = _COMMENT_RE.sub(" ", s)
    s = _BRACKET_TAG_RE.sub(" ", s)
    s = _NAG_RE.sub(" ", s)
    s = " ".join(s.split())
    return s


def fen_hash(fen: str) -> int:
    """
    Hash stable 64 bits signé basé sur le FEN.
    Compatible BIGINT PostgreSQL (positif).
    """
    h = hashlib.sha256(fen.encode("utf-8")).digest()
    val = int.from_bytes(h[:8], byteorder="big", signed=False)
    val &= (1 << 63) - 1  # Force positif
    return val


def outcome_from_resultat(resultat: int):
    """
    Convertit le champ 'resultat' en (victoires_blanc, victoires_noir, nulles).

    Convention :
      2 -> 1-0 (victoire blanc)
      0 -> 0-1 (victoire noir)
      1 -> autre (nulle)
    """
    if resultat == 2:
        return 1, 0, 0
    elif resultat == 0:
        return 0, 1, 0
    else:
        return 0, 0, 1


def iter_positions_from_pgn(pgn_moves: str):
    """
    Génère tous les FEN atteints dans une partie.

    :param pgn_moves: String PGN avec les coups
    :yield: chess.Board pour chaque position
    """
    if not pgn_moves:
        return

    cleaned = clean_pgn_moves(pgn_moves)
    if not cleaned:
        return

    board = chess.Board()
    yield board  # Position initiale

    tokens = cleaned.split()
    for token in tokens:
        if token in ("1-0", "0-1", "1/2-1/2", "*"):
            break

        if token.endswith(".") or token == "...":
            continue

        try:
            board.push_san(token)
            yield board
        except Exception:
            break  # PGN corrompu


def parse_partie(partie):
    """
    Parse une partie et retourne toutes ses positions hashées.

    :param partie: Tuple (id, pgn, resultat)
    :return: Liste de tuples (hash, fen, nb_total, w, b, d)
    """
    partie_id, pgn_moves, resultat = partie

    if not pgn_moves:
        return []

    w_inc, b_inc, d_inc = outcome_from_resultat(resultat)

    positions = []
    try:
        for board in iter_positions_from_pgn(pgn_moves):
            fen = board.fen()
            h = fen_hash(fen)
            positions.append((h, fen, 1, w_inc, b_inc, d_inc))
    except Exception as e:
        print(f"Erreur parsing partie {partie_id}: {e}")

    return positions


def get_positions_from_parties(parties):
    """
    Parse toutes les parties et retourne positions hashées.

    :param parties: Liste de tuples (id, pgn, resultat)
    :return: Liste de positions
    """
    all_positions = []

    for partie in parties:
        positions = parse_partie(partie)
        all_positions.extend(positions)

    return all_positions