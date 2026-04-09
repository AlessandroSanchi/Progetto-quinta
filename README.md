

## Descrizione

Un semplice gioco di sopravvivenza implementato con Canvas/JavaScript sul frontend e Flask come backend. L'obiettivo è sopravvivere il più a lungo possibile evitando nemici e proiettili: il tempo di sopravvivenza viene registrato e salvato nella classifica.

Funzionalità principali:
- autenticazione (registrazione/login)
- salvataggio dei punteggi di sopravvivenza
- classifica consultabile dall'interfaccia di gioco

Il gioco è pensato come demo educativa e base per esperimenti di game-feel, bilanciamento e meccaniche di sopravvivenza.

## Struttura del progetto

- `app.py` — Punto d'ingresso del backend (configurazione Flask, blueprint principale)
- `run.py` — Script per avviare l'applicazione
- `setup_db.py` — (opzionale) script per inizializzare il DB
- `schema.sql` / `app/schema.sql` — schema SQL per il database
- `app/` — codice dell'applicazione (blueprints, DB, template rendering)
- `app/static/` e `static/` — risorse statiche (CSS, JS, immagini)
  - `static/css/styles.css` — stili
  - `static/js/game.js` — logica del gioco (nemici, spawn, timer, invio punteggio)
- `app/templates/` — template Jinja2 (`index.html`, `login.html`, `register.html`, `leaderboard.html`)

Nota: il database SQLite viene creato nella cartella `instance/` come `instance/game.sqlite` quando l'app è avviata (se non esiste).

## Requisiti

- Python 3.8+ (consigliato)
- Dipendenze elencate in `requirements.txt` (Flask e librerie correlate)

## Installazione e avvio (Windows PowerShell)

1. Crea un virtual environment e installa le dipendenze:

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. (Opzionale) Imposta la chiave segreta per le sessioni Flask:

```powershell
$env:FLASK_SECRET_KEY = "tuo-secret-random"
```

3. Avvia l'app:

```powershell
python .\run.py
```

4. Apri il browser su http://127.0.0.1:5000 — registra un account, effettua il login e gioca.

## Database

- I punteggi vengono salvati in `instance/game.sqlite` (SQLite).
- Lo schema iniziale è disponibile in `app/schema.sql`.

Se vuoi resettare il database manualmente, rimuovi `instance/game.sqlite` e riavvia l'app; verrà ricreato automaticamente (se il codice dell'app gestisce la creazione automatica).

## Uso e funzionalità

- Registrazione e login per associare i punteggi a un utente.
- Invio dei punteggi al backend e visualizzazione della classifica dalla pagina di gioco o tramite la rotta `/leaderboard`.

## Possibili miglioramenti

- Aggiungere test automatici (unit/integration)
- Aggiungere una route per inizializzare/ricreare il DB (`/init-db`) protetta
- Fornire un `Dockerfile` e `docker-compose.yml` per eseguire l'app in container
- Aggiungere validazione e rate-limiting per le submission dei punteggi

