`````markdown
# README – Installation & Setup

This document describes, in order, the steps to prepare the environment, build the images, and launch the application.

---

## 0) Create a **GitLab Personal Access Token**

1. Open **GitLab** → **Preferences** → **Access Tokens**.
2. Click **Add new token** and choose a clear name.
3. Check the following permissions:

   * ✅ `api`
   * ✅ `read_registry`
   * ✅ `write_registry`
4. Click **Create personal access token** and **copy the token immediately** once it's displayed.

> Keep this token secure; it may be referenced via `.env` if needed. With Git over HTTPS, it may also be requested as a **password** during `clone/pull/push` operations.

---

## 1) Clone the repository

> **Note**: the GitLab server may have a misconfigured SSL certificate. Two options:
>
> **Option A – Disable globally (quick but not recommended)**
>
> ```bash
> git config --global http.sslVerify false
> git clone https://gitlabvigan.iem/m1projettutore2025-2026-groupe4/lichess-2025-2026.git
> cd lichess-2025-2026
> ```
>
> **Option B – Disable on a case-by-case basis (recommended)**
>
> ```bash
> git -c http.sslVerify=false clone https://gitlabvigan.iem/m1projettutore2025-2026-groupe4/lichess-2025-2026.git
> cd lichess-2025-2026
> ```
>
> Remember to re-enable SSL verification later if you used Option A:
>
> ```bash
> git config --global http.sslVerify true
> ```

---

## 2) Prerequisites: install Docker & Docker Compose

Follow the official documentation for your system to install **Docker** and **Docker Compose**.

**Check the installation:**

```bash
docker --version
docker compose version
```

### Add your user to the `docker` group

To run Docker without `sudo`:

```bash
sudo usermod -aG docker $USER
```

> Log out and log back in (or restart the machine) for the change to take effect.

**Quick check:**

```bash
docker ps
```

If the command runs without error, you're correctly in the `docker` group.

---

## 3) Environment configuration – `.env` file

The `.env` file centralizes the project's configuration variables (ports, URLs, credentials, secrets, etc.).

1. Copy the provided template:

   ```bash
   cp .env.example .env
   ```
2. Open `.env` and adjust the **values** to your local context (domains, ports, passwords, API keys, etc.).
3. Keep `.env` **local** (do not commit it if the repository is public) since it contains secrets.

> **Note:** Several services (Traefik, MinIO, etc.) read their settings from this file. Make sure **all** required keys are filled in before starting.

---

## 4) Generate development certificates (Traefik)

Go to the `traefik` directory:

```bash
cd traefik
```

Generate the RSA private key:

```bash
openssl genrsa -out private.key 2048
```

Generate the self-signed certificate (replace `docker.localhost` with your own domain if needed):

```bash
openssl req -new -x509 -key private.key -out cert.pem -days 365 -subj "/CN=docker.localhost"
```

> **Note:** Browsers will show a warning (insecure connection) since the certificate isn't signed by a trusted authority. For **development** purposes, this is sufficient.

---

## 5) Build the images and launch the containers

Once `.env` is filled in, build and launch:

```bash
docker compose up --build
```
---

## 6) MinIO configuration

### Log in to the MinIO interface

* **Default development URL**: [https://storage.docker.localhost/](https://storage.docker.localhost/)
  *(Adjust according to your domain name.)*
* On the login screen: **Other Authentication Methods** → **Use Credentials**.
* **Username**: `minio_admin`
* **Password**: value set when running `generate_env.py` (or in your `.env`).

Root credentials are configured in the `.env` file via:

```
MINIO_ROOT_USER=minio_admin
MINIO_ROOT_PASSWORD=CHANGEME
```

### Create an Access Key

1. Open **Access Keys** in the left sidebar.
2. Click **Create access key +**.
3. Click **Create** to generate a new pair (Access/Secret).
4. **Copy** the generated values and update your `.env`:

```
# Internal URL used by services (Docker ↔ MinIO)
MINIO_SERVER_URL=http://minio:9000

# MinIO application access credentials
MINIO_ACCESS_KEY=PASTE_ACCESS_KEY_HERE
MINIO_SECRET_KEY=PASTE_SECRET_KEY_HERE
```

> Tip: keep these keys safe and never commit them to version control.

**Things to plan for:**

* Where to retrieve credentials (MinIO UI, default variables, initialization process...).
* Which variables to add to `.env` (e.g. `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_REGION`, `MINIO_BUCKET_*`, etc.).
* Best practices (least-privilege access, secret rotation, keeping secrets out of version control).

---

## 7) Notes & troubleshooting (quick)

* If `docker ps` fails without `sudo`, check that you're in the `docker` group and reconnect your session.
* An SSL warning in the browser is expected in **dev** with a self-signed certificate.
* Make sure all sensitive `.env` values are properly set before running `docker compose up`.
* If you're on Windows, watch out for line endings. To properly configure your project, use the commands below:

```
git config core.autocrlf input
git rm --cached -r .
git reset --hard
```

---

## 8) Dev URLs
https://minio.docker.localhost
https://api.docker.localhost (backend)
https://traefik.docker.localhost (Traefik URL in dev)

---

## 9) Running the ETL/DB
* To run the ETL, launch Docker Desktop then:

* Go to the project directory and copy the `.env` file into the `/etl` folder:
   ```bash
  cp ./env ./etl/.env
  ```
* Build & launch docker:
    ```bash
  docker compose build
  docker compose up -d
  ```
* Then just run the ETL via:
   ```
  docker compose --profile jobs build etl (sometimes needed for code changes to take effect, not sure why)
  docker compose --profile jobs run --remove-orphans etl (remove-orphans to reduce memory usage if run multiple times)
  ```
* To access the PostgreSQL DB:
   ```bash
  docker compose exec postgres psql -U chessmate -d chessmate
  ```
`````
