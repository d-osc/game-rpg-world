---
name: reverse-proxy-ssl
description: Reverse proxy and SSL/TLS configuration — Nginx, Caddy, Cloudflare setup, SSL/TLS hardening, HTTP/2 & HTTP/3, WebSocket proxying, load balancing, rate limiting, access control, CDN configuration, and certificate management
---

# Reverse Proxy / SSL (Nginx, Caddy, Cloudflare)

## Nginx

### Basic Reverse Proxy

```nginx
# /etc/nginx/sites-available/quotation-app

upstream app_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name quotation.example.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name quotation.example.com;

    # --- SSL Configuration ---
    ssl_certificate     /etc/letsencrypt/live/quotation.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/quotation.example.com/privkey.pem;

    # SSL hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;

    # Session settings
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/quotation.example.com/chain.pem;
    resolver 1.1.1.1 8.8.8.8 valid=300s;
    resolver_timeout 5s;

    # --- Security Headers ---
    add_header Strict-Transport-Security "max-age=15768000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "0" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';" always;

    # --- Logging ---
    access_log /var/log/nginx/quotation_access.log;
    error_log  /var/log/nginx/quotation_error.log;

    # Max upload
    client_max_body_size 10M;

    # --- Reverse Proxy ---
    location / {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;

        # Proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # Keepalive
        proxy_set_header Connection "";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # --- WebSocket Support ---
    location /ws/ {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;  # 24h for long-lived WebSocket
        proxy_send_timeout 86400s;
    }

    # --- Static Files (serve directly) ---
    location /assets/ {
        alias /var/www/quotation-app/public/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;

        # Pre-compressed files (gzip/brotli)
        gzip_static on;
        # brotli_static on;  # requires ngx_brotli module
    }

    location /favicon.ico {
        alias /var/www/quotation-app/public/favicon.ico;
        expires 30d;
        access_log off;
    }

    # --- Block sensitive files ---
    location ~ /\.(env|git|htaccess) {
        deny all;
        return 404;
    }

    location ~* \.(log|sql|bak|swp|conf)$ {
        deny all;
        return 404;
    }
}
```

### Load Balancing

```nginx
# Round-robin (default)
upstream app_backend {
    server 10.0.1.10:3000;
    server 10.0.1.11:3000;
    server 10.0.1.12:3000;
    keepalive 64;
}

# Least connections
upstream app_backend {
    least_conn;
    server 10.0.1.10:3000;
    server 10.0.1.11:3000;
    keepalive 64;
}

# Weighted (stronger servers get more traffic)
upstream app_backend {
    server 10.0.1.10:3000 weight=3;
    server 10.0.1.11:3000 weight=2;
    server 10.0.1.12:3000 weight=1;
    keepalive 64;
}

# With health checks (open source — passive)
upstream app_backend {
    server 10.0.1.10:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s backup;
    keepalive 64;
}

# IP hash (session affinity)
upstream app_backend {
    ip_hash;
    server 10.0.1.10:3000;
    server 10.0.1.11:3000;
    keepalive 64;
}
```

### Rate Limiting

```nginx
# /etc/nginx/nginx.conf — in http block

# Rate limit zones
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/m;

# Connection limit
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
```

```nginx
# In server block
server {
    # General rate limit for all requests
    limit_req zone=general burst=20 nodelay;
    limit_conn conn_limit 50;

    # API rate limiting
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        limit_req_status 429;

        proxy_pass http://app_backend;
        # ... proxy headers
    }

    # Auth endpoints — stricter
    location /api/auth/ {
        limit_req zone=auth burst=3 nodelay;
        limit_req_status 429;

        proxy_pass http://app_backend;
        # ... proxy headers
    }

    # File uploads
    location /api/upload {
        limit_req zone=upload burst=2 nodelay;

        proxy_pass http://app_backend;
        # ... proxy headers
    }

    # Custom rate limit error page
    error_page 429 /429.html;
    location = /429.html {
        internal;
        default_type application/json;
        return 429 '{"error":"Too many requests","retryAfter":60}';
    }
}
```

### IP-Based Access Control

```nginx
# Allow only specific IPs
location /admin/ {
    allow 203.0.113.0/24;    # office network
    allow 10.0.0.0/8;         # VPN
    deny all;

    proxy_pass http://app_backend;
}

# Block specific countries (with GeoIP)
# Requires: apt install libnginx-mod-http-geoip2
# maxmind database required

# Basic auth
location /staging/ {
    auth_basic "Staging Area";
    auth_basic_user_file /etc/nginx/.htpasswd;

    proxy_pass http://app_backend;
}
```

```bash
# Create htpasswd file
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd admin
# Add another user
sudo htpasswd /etc/nginx/.htpasswd developer
```

### Gzip Compression

```nginx
# /etc/nginx/nginx.conf — in http block
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 4;
gzip_min_length 256;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/json
    application/javascript
    application/xml
    application/rss+xml
    application/atom+xml
    image/svg+xml
    font/woff2
    font/woff;
```

### Brotli Compression (Optional)

```nginx
# Requires ngx_brotli module
# apt install libnginx-mod-http-brotli

brotli on;
brotli_comp_level 4;
brotli_types
    text/plain
    text/css
    text/javascript
    application/json
    application/javascript
    application/xml
    image/svg+xml;
```

### Server-Side Cache

```nginx
# Proxy cache — cache responses from upstream
proxy_cache_path /var/cache/nginx/proxy
    levels=1:2
    keys_zone=api_cache:10m
    max_size=100m
    inactive=60m
    use_temp_path=off;

server {
    # Cache API responses
    location /api/public/ {
        proxy_cache api_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_valid 404 1m;
        proxy_cache_use_stale error timeout updating;
        proxy_cache_lock on;
        proxy_cache_key "$scheme$request_method$host$request_uri";

        add_header X-Cache-Status $upstream_cache_status;

        proxy_pass http://app_backend;
    }
}
```

### Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Reload config (zero downtime)
sudo systemctl reload nginx

# Restart
sudo systemctl restart nginx

# Status
sudo systemctl status nginx

# Enable site
sudo ln -s /etc/nginx/sites-available/quotation-app /etc/nginx/sites-enabled/

# Disable site
sudo rm /etc/nginx/sites-enabled/quotation-app

# Check open file limits
cat /proc/$(cat /var/run/nginx.pid)/limits | grep "Max open files"

# Dump full config (resolve includes)
sudo nginx -T
```

## Caddy

### Basic Caddyfile

```
# /etc/caddy/Caddyfile

quotation.example.com {
    # Automatic HTTPS (Let's Encrypt)
    # Caddy handles SSL automatically — no certbot needed

    reverse_proxy localhost:3000

    # Security headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
        Strict-Transport-Security "max-age=15768000; includeSubDomains; preload"
        -Server    # hide Caddy version
    }

    # Compression (automatic in Caddy)
    encode gzip zstd

    # Logging
    log {
        output file /var/log/caddy/quotation_access.log {
            roll_size 10mb
            roll_keep 5
        }
        format json
    }
}
```

### Advanced Caddyfile

```
quotation.example.com {
    # WebSocket support — automatic with reverse_proxy

    # API with rate limiting
    handle /api/* {
        rate_limit {remote.host} 30r/m
        reverse_proxy localhost:3000
    }

    # Stricter rate limit for auth
    handle /api/auth/* {
        rate_limit {remote.host} 5r/m
        reverse_proxy localhost:3000
    }

    # Static files with caching
    handle /assets/* {
        root * /var/www/quotation-app/public
        file_server {
            precompressed br gzip
        }
        header Cache-Control "public, max-age=31536000, immutable"
    }

    # Everything else — reverse proxy
    handle {
        reverse_proxy localhost:3000 {
            # Health check
            health_uri /health
            health_interval 10s
            health_timeout 5s

            # Headers
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}

            # Timeouts
            transport http {
                read_timeout 60s
                write_timeout 60s
                dial_timeout 10s
            }
        }
    }

    # Block sensitive files
    @blocked path /.env /.git/* *.log *.sql *.bak
    respond @blocked 404 {
        close
    }
}
```

### Load Balancing with Caddy

```
quotation.example.com {
    reverse_proxy {
        to 10.0.1.10:3000
        to 10.0.1.11:3000
        to 10.0.1.12:3000

        # Load balancing policy
        lb_policy least_conn
        # lb_policy round_robin
        # lb_policy random
        # lb_policy ip_hash

        # Health checks
        health_uri /health
        health_interval 10s

        # Failover
        fail_duration 30s
    }
}
```

### Caddy Commands

```bash
# Install (Debian/Ubuntu)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Validate config
caddy validate --config /etc/caddy/Caddyfile

# Format config
caddy fmt --overwrite /etc/caddy/Caddyfile

# Reload config
sudo systemctl reload caddy

# Restart
sudo systemctl restart caddy

# Run manually (dev)
caddy run --config Caddyfile

# Get certificate info
caddy list-modules | grep tls
```

## Cloudflare

### DNS Setup

```
# Cloudflare Dashboard → DNS → Records

# A Record — point to VPS IP
Type: A
Name: quotation.example.com
Content: 203.0.113.10
Proxy: Proxied (orange cloud)    # enables CDN/DDoS protection

# AAAA Record (if IPv6)
Type: AAAA
Name: quotation.example.com
Content: 2001:db8::1
Proxy: Proxied

# For subdomain not behind Cloudflare (e.g., direct SSH)
Type: A
Name: direct.example.com
Content: 203.0.113.10
Proxy: DNS only (grey cloud)     # no CDN, direct connection
```

### SSL/TLS Modes

```
# Cloudflare Dashboard → SSL/TLS → Overview

# 1. Off — no encryption (never use)
# 2. Flexible — Cloudflare→origin is HTTP (user sees HTTPS, but CF→server is plain)
#    NOT RECOMMENDED — traffic between CF and server is unencrypted

# 3. Full — Cloudflare→origin uses HTTPS, but doesn't verify cert
#    OK for self-signed certs on origin

# 4. Full (Strict) — Cloudflare→origin uses HTTPS AND verifies cert
#    RECOMMENDED — use Let's Encrypt or Cloudflare Origin Certificate

# Recommended: Full (Strict) with origin certificate
```

### Cloudflare Origin Certificate

```bash
# Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate

# Option 1: Use Cloudflare Origin Cert (15 year validity)
# Download .pem and .key files → place on server

# Option 2: Use Let's Encrypt (auto-renew via Certbot)
# Cloudflare proxy handles public-facing SSL
# Let's Encrypt handles CF→origin encryption

# Nginx config with Cloudflare Origin Cert
ssl_certificate     /etc/ssl/cloudflare/quotation.example.com.pem;
ssl_certificate_key /etc/ssl/cloudflare/quotation.example.com.key;
```

### Cloudflare Recommended Settings

```
# Speed → Optimization
Auto Minify:       JavaScript, CSS, HTML (all checked)
Brotli:            On
Early Hints:       On
Rocket Loader:     Off (can break apps — test first)
HTTP/2:            On
HTTP/3 (QUIC):     On
0-RTT Connection:  On

# SSL/TLS → Edge Certificates
Minimum TLS Version:    TLS 1.2
Always Use HTTPS:       On
Automatic HTTPS Rewrite: On
Opportunistic Encryption: On

# Security → Settings
Security Level:      Medium
Challenge Passage:   30 minutes
Browser Integrity:   On
Privacy Pass:        On

# Security → WAF (Web Application Firewall)
Managed Rules:       On (Cloudflare Ruleset)
OWASP Core Ruleset:  On

# Caching → Configuration
Browser Cache TTL:      4 hours
Always Online:          On
Development Mode:       Off (turn on temporarily when testing)
```

### Cloudflare Page Rules (Cache)

```
# Cache static assets
URL: *quotation.example.com/assets/*
Setting: Cache Level = Cache Everything
Setting: Edge Cache TTL = 1 month
Setting: Browser Cache TTL = 1 year

# Bypass cache for admin
URL: *quotation.example.com/admin/*
Setting: Cache Level = Bypass
Setting: Security Level = High

# Always HTTPS
URL: *quotation.example.com/*
Setting: Always Use HTTPS
```

### Cloudflare Cache Rules (New)

```
# Rules → Page Rules → Cache Rules (new format)

# Cache static assets
Expression: (http.request.uri.path contains "/assets/") or
            (http.request.uri.path contains "/static/")
Action: Override origin
Edge TTL: Override, 30 days
Browser TTL: Override, 1 year
Cache everything: true

# Bypass for API
Expression: http.request.uri.path contains "/api/"
Action: Bypass cache

# Bypass for authenticated pages
Expression: http.cookie contains "session_token"
Action: Bypass cache
```

### Cloudflare Workers (Edge Logic)

```javascript
// Simple edge worker — add security headers
export default {
    async fetch(request, env) {
        const response = await fetch(request);

        // Clone to modify headers
        const newResponse = new Response(response.body, response);

        newResponse.headers.set("X-Content-Type-Options", "nosniff");
        newResponse.headers.set("X-Frame-Options", "DENY");
        newResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

        return newResponse;
    },
};
```

### Real IP from Cloudflare

```nginx
# /etc/nginx/nginx.conf — in http block
# Trust Cloudflare IPs for real IP detection

# Cloudflare IP ranges (update periodically)
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;

real_ip_header CF-Connecting-IP;
real_ip_recursive on;
```

## SSL/TLS Deep Dive

### Certificate Types

```
Domain Validated (DV)     — Let's Encrypt, automatic, free
                           ✓ Domain ownership verified
                           ✗ No organization validation

Organization Validated (OV) — Paid CA, manual verification
                           ✓ Organization verified
                           ✓ Shows company name in cert

Extended Validation (EV)   — Paid CA, extensive verification
                           ✓ Highest trust level
                           ✓ Green bar (legacy browsers)

# For most apps: Let's Encrypt (DV) + Cloudflare proxy = sufficient
```

### Certificate Management

```bash
# Let's Encrypt with Certbot

# Install
sudo apt install certbot python3-certbot-nginx

# Obtain certificate (Nginx plugin — auto-modifies config)
sudo certbot --nginx -d quotation.example.com

# Obtain certificate (standalone — for Caddy or manual setup)
sudo certbot certonly --standalone -d quotation.example.com

# Obtain certificate (DNS challenge — works behind load balancer)
sudo certbot certonly --manual --preferred-challenges dns -d quotation.example.com

# Wildcard certificate (requires DNS challenge)
sudo certbot certonly --manual --preferred-challenges dns -d "*.example.com" -d "example.com"

# Renew all certificates
sudo certbot renew

# Dry run (test renewal without actually renewing)
sudo certbot renew --dry-run

# Auto-renewal is handled by systemd timer
sudo systemctl list-timers | grep certbot

# Force renew specific cert
sudo certbot renew --force-renewal --cert-name quotation.example.com

# List all certificates
sudo certbot certificates

# Delete certificate
sudo certbot delete --cert-name quotation.example.com

# Certificate file locations
/etc/letsencrypt/live/quotation.example.com/fullchain.pem   # cert + chain
/etc/letsencrypt/live/quotation.example.com/privkey.pem     # private key
/etc/letsencrypt/live/quotation.example.com/cert.pem        # cert only
/etc/letsencrypt/live/quotation.example.com/chain.pem       # chain only
```

### SSL Testing

```bash
# Test SSL configuration (external)
# https://www.ssllabs.com/ssltest/analyze.html?d=quotation.example.com

# Check cert expiry
echo | openssl s_client -connect quotation.example.com:443 -servername quotation.example.com 2>/dev/null | openssl x509 -noout -dates -subject

# Check cert chain
openssl s_client -connect quotation.example.com:443 -servername quotation.example.com -showcerts

# Verify cert matches key
openssl x509 -noout -modulus -in fullchain.pem | openssl md5
openssl rsa -noout -modulus -in privkey.pem | openssl md5
# Hashes should match

# Check supported protocols
nmap --script ssl-enum-ciphers -p 443 quotation.example.com

# Test TLS 1.3 support
openssl s_client -connect quotation.example.com:443 -tls1_3

# Check OCSP
openssl ocsp -issuer chain.pem -cert cert.pem -url http://ocsp.int-x3.letsencrypt.org -resp_text
```

### DH Parameters (for DHE ciphers)

```bash
# Generate DH parameters (slow — takes minutes)
openssl dhparam -out /etc/nginx/dhparam.pem 2048

# In Nginx config
ssl_dhparam /etc/nginx/dhparam.pem;
```

## HTTP/2 & HTTP/3

### HTTP/2 (Nginx)

```nginx
# HTTP/2 is enabled with the http2 parameter
listen 443 ssl http2;

# HTTP/2 push (deprecated — use preload headers instead)
# <link rel="preload" href="/critical.css" as="style">

# HTTP/2 server push (if needed)
location = /index.html {
    http2_push /assets/critical.css;
    http2_push /assets/app.js;
}
```

### HTTP/3 (QUIC)

```nginx
# Requires nginx 1.25+ with HTTP/3 module
# Listen on UDP for QUIC
listen 443 quic reuseport;
listen 443 ssl;
http2 on;

# Advertise HTTP/3 via Alt-Svc header
add_header Alt-Svc 'h3=":443"; ma=86400';

# For older nginx versions, use Cloudflare for HTTP/3
# Cloudflare enables HTTP/3 automatically in proxy mode
```

### Caddy HTTP/3

```
# Caddy supports HTTP/3 automatically (since v2)
# No extra config needed — just enable in Cloudflare or browser

quotation.example.com {
    # HTTP/3 is auto-negotiated
    reverse_proxy localhost:3000
}
```

## Complete Production Setup (Nginx + Cloudflare)

```nginx
# /etc/nginx/sites-available/quotation-app

# Trust Cloudflare IPs
# (placed in http block of nginx.conf)

upstream app_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# Rate limit zones (in http block of nginx.conf)
# limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
# limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

server {
    listen 80;
    server_name quotation.example.com;

    # CF connects on 80 sometimes — redirect to HTTPS
    if ($http_x_forwarded_proto = "http") {
        return 301 https://$host$request_uri;
    }
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name quotation.example.com;

    # SSL — Cloudflare Origin Certificate
    ssl_certificate     /etc/ssl/cloudflare/quotation.example.com.pem;
    ssl_certificate_key /etc/ssl/cloudflare/quotation.example.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Only allow Cloudflare IPs (optional — defense in depth)
    # allow 173.245.48.0/20;
    # allow 103.21.244.0/22;
    # ... all CF ranges
    # deny all;

    # Logging with real IP (from CF-Connecting-IP)
    access_log /var/log/nginx/quotation_access.log;
    error_log  /var/log/nginx/quotation_error.log;

    client_max_body_size 10M;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 4;
    gzip_min_length 256;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Reverse proxy
    location / {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $http_cf_connecting_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $http_cf_connecting_ip;
        proxy_read_timeout 86400s;
    }

    # Static files with long cache (CF caches these too)
    location /assets/ {
        alias /var/www/quotation-app/public/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        gzip_static on;
        access_log off;
    }

    # API rate limiting
    location /api/auth/ {
        limit_req zone=auth burst=3 nodelay;
        limit_req_status 429;
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $http_cf_connecting_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        limit_req zone=api burst=10 nodelay;
        limit_req_status 429;
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $http_cf_connecting_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Block sensitive files
    location ~ /\.(env|git) { deny all; return 404; }
    location ~* \.(log|sql|bak|conf)$ { deny all; return 404; }
}
```

## Quick Troubleshooting

```bash
# Nginx config test
sudo nginx -t

# Check if Nginx is listening
ss -tulpn | grep :443

# Check SSL handshake
curl -vI https://quotation.example.com 2>&1 | grep -E "SSL|subject|issuer|HTTP"

# Check real IP passing through
curl -H "CF-Connecting-IP: 1.2.3.4" https://quotation.example.com/debug-headers

# Test WebSocket
wscat -c wss://quotation.example.com/ws/

# Check HTTP/2
curl -I --http2 https://quotation.example.com

# Monitor access log in real-time
sudo tail -f /var/log/nginx/quotation_access.log

# Check for 5xx errors
grep " 5[0-9][0-9] " /var/log/nginx/quotation_access.log | tail -20

# Check upstream response times
# Add to log_format: $upstream_response_time
awk '{print $NF}' /var/log/nginx/quotation_access.log | sort -n | tail -20
```

## Code Style Rules

- Use Nginx for full control (rate limiting, caching, headers) — use Caddy for simplicity (auto-HTTPS, simpler config).
- Always redirect HTTP to HTTPS — never serve plaintext in production.
- Use TLS 1.2+ only — disable TLS 1.0 and 1.1.
- Set `Strict-Transport-Security` with `includeSubDomains; preload` — enforce HTTPS across the domain.
- Use Cloudflare in Full (Strict) mode — encrypt traffic between CF and origin.
- Configure `real_ip_header CF-Connecting-IP` when behind Cloudflare — log real client IPs.
- Enable OCSP stapling — faster TLS handshakes, better privacy.
- Use `keepalive` in upstream blocks — reuse connections between Nginx and Node.js.
- Set WebSocket `proxy_read_timeout` to 86400s — prevent premature connection drops.
- Serve static files directly from Nginx — don't proxy through Node.js.
- Use `gzip_static on` for pre-compressed files — serve `.gz` variants without on-the-fly compression.
- Configure rate limiting per endpoint type — stricter for auth, relaxed for general API.
- Block access to sensitive files (`.env`, `.git`, `.log`) — deny all at the proxy level.
- Test SSL configuration with SSL Labs — target A+ rating.
- Use Cloudflare Page Rules or Cache Rules for edge caching — cache static assets at CF edge.
