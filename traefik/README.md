# Traefik Reverse Proxy & Automated SSL (Let's Encrypt)

This directory contains the production Docker Compose configuration for **Traefik v3**, providing automatic SSL certificates via Let's Encrypt, HTTP-to-HTTPS redirect, and reverse proxy routing to the Web Control Dashboard (`/ui`).

---

## 📁 Files

* `docker-compose.yml` — Runs Traefik in host network mode for high-performance edge routing.
* `traefik.yml` — Static Traefik configuration (entrypoints, cert resolvers, dashboard).
* `dynamic_conf.yml` — Dynamic routing rules forwarding custom domains to local services.

---

## 🚀 Setup & Deployment

### 1. Configure your Domain & Email

1. Point your domain's DNS **A Record** (e.g. `uai.yourdomain.com`) to your server IP address.
2. Edit `traefik.yml` to specify your email for Let's Encrypt certificate renewal:
   ```yaml
   certificatesResolvers:
     letsencrypt:
       acme:
         email: "your-email@example.com"
         storage: "/acme.json"
   ```
3. Edit `dynamic_conf.yml` to match your domain:
   ```yaml
   http:
     routers:
       nanoclaw-ui-router:
         rule: "Host(`uai.yourdomain.com`)"
         entryPoints:
           - websecure
         service: nanoclaw-ui-service
         tls:
           certResolver: letsencrypt
   ```

### 2. Create the Certificate Storage File

```bash
touch acme.json
chmod 600 acme.json
```

### 3. Launch Traefik

```bash
docker compose up -d
```

Traefik will automatically provision a valid Let's Encrypt TLS certificate on the first request and handle renewals in background.
