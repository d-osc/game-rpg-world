---
name: linux-vps
description: Linux server & VPS administration — SSH hardening, firewall (ufw/iptables), systemd services, Nginx reverse proxy, PM2 process management, SSL/TLS with Certbot, log management, backup strategies, monitoring, disk management, user management, cron jobs, and deployment automation
---

# Linux / VPS Administration

## SSH Hardening

### Secure sshd_config

```bash
# /etc/ssh/sshd_config — apply these settings

# Disable password authentication
PasswordAuthentication no
PubkeyAuthentication yes

# Disable root login
PermitRootLogin no

# Limit to specific users/groups
AllowUsers deploy appadmin
# or
AllowGroups ssh-users

# Use only SSH protocol 2 (default on modern systems)
Protocol 2

# Reduce login grace time
LoginGraceTime 30

# Limit auth attempts
MaxAuthTries 3

# Disable unused auth methods
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
UsePAM no
HostbasedAuthentication no
GSSAPIAuthentication no
X11Forwarding no

# Set idle timeout (seconds)
ClientAliveInterval 300
ClientAliveCountMax 2

# Restrict to strong ciphers and MACs
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org

# Logging
SyslogFacility AUTH
LogLevel VERBOSE

# Apply changes
sudo systemctl restart sshd
```

### SSH Key Setup

```bash
# Generate ED25519 key (preferred — faster, more secure)
ssh-keygen -t ed25519 -C "deploy@quotation-app" -f ~/.ssh/quotation_deploy

# Generate RSA key (if ED25519 not supported)
ssh-keygen -t rsa -b 4096 -C "deploy@quotation-app" -f ~/.ssh/quotation_deploy

# Copy public key to server
ssh-copy-id -i ~/.ssh/quotation_deploy.pub deploy@your-server-ip

# Use SSH config for easy connections
# ~/.ssh/config
Host quotation-prod
    HostName 203.0.113.10
    User deploy
    Port 22
    IdentityFile ~/.ssh/quotation_deploy
    ServerAliveInterval 60
    ServerAliveCountMax 3

Host quotation-staging
    HostName 203.0.113.11
    User deploy
    IdentityFile ~/.ssh/quotation_deploy

# Connect
ssh quotation-prod
```

### SSH Jump Host (Bastion)

```bash
# ~/.ssh/config — connect through bastion
Host bastion
    HostName 203.0.113.1
    User admin
    IdentityFile ~/.ssh/bastion_key

Host prod-internal
    HostName 10.0.1.50
    User deploy
    IdentityFile ~/.ssh/quotation_deploy
    ProxyJump bastion

# Connect through bastion
ssh prod-internal
```

## User Management

```bash
# Create user with home directory and bash shell
sudo useradd -m -s /bin/bash deploy

# Set password
sudo passwd deploy

# Add to sudo group
sudo usermod -aG sudo deploy

# Add to ssh-users group (for AllowGroups)
sudo groupadd ssh-users
sudo usermod -aG ssh-users deploy

# Create application user (no login shell)
sudo useradd -r -s /usr/sbin/nologin appuser

# Delete user
sudo userdel -r deploy

# Lock/unlock account
sudo passwd -l deploy    # lock
sudo passwd -u deploy    # unlock

# View user groups
groups deploy
id deploy

# Switch to user
sudo su - deploy
```

## Firewall (UFW)

```bash
# Install and enable
sudo apt install ufw
sudo ufw enable

# Default policies — deny all incoming, allow all outgoing
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (IMPORTANT — do this before enabling!)
sudo ufw allow 22/tcp
# or with comment
sudo ufw allow 22/tcp comment 'SSH'

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Allow from specific IP only
sudo ufw allow from 203.0.113.50 to any port 22 proto tcp comment 'Office SSH'

# Allow port range
sudo ufw allow 3000:3010/tcp comment 'App range'

# Allow specific application ports
sudo ufw allow 5432/tcp  comment 'PostgreSQL'
sudo ufw allow 6379/tcp  comment 'Redis'

# Rate limit SSH (blocks IPs with too many connections)
sudo ufw limit 22/tcp comment 'SSH rate-limited'

# Delete rule
sudo ufw delete allow 80/tcp
# or by numbered list
sudo ufw status numbered
sudo ufw delete 3

# View status
sudo ufw status verbose
sudo ufw status numbered

# Reset all rules
sudo ufw reset

# Reload after changes
sudo ufw reload
```

### iptables (Advanced)

```bash
# View current rules
sudo iptables -L -n -v

# Allow established connections
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Allow loopback
sudo iptables -A INPUT -i lo -j ACCEPT

# Allow SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Drop everything else
sudo iptables -A INPUT -j DROP

# Block specific IP
sudo iptables -A INPUT -s 1.2.3.4 -j DROP

# Save rules (persist across reboot)
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

## Nginx Reverse Proxy

### Basic Setup

```bash
# Install
sudo apt install nginx

# Enable and start
sudo systemctl enable nginx
sudo systemctl start nginx

# Test config
sudo nginx -t

# Reload config (zero downtime)
sudo systemctl reload nginx
```

### Reverse Proxy Config

```nginx
# /etc/nginx/sites-available/quotation-app

# Rate limiting zone (defined in http block of nginx.conf)
# limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;

# Upstream — Node.js app on PM2
upstream quotation_app {
    server 127.0.0.1:3000;
    keepalive 64;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name quotation.example.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name quotation.example.com;

    # SSL certificates (Certbot)
    ssl_certificate     /etc/letsencrypt/live/quotation.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/quotation.example.com/privkey.pem;

    # SSL hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS (6 months)
    add_header Strict-Transport-Security "max-age=15768000; includeSubDomains; preload" always;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "0" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logs
    access_log /var/log/nginx/quotation_access.log;
    error_log  /var/log/nginx/quotation_error.log;

    # Max upload size
    client_max_body_size 10M;

    # Reverse proxy to Node.js app
    location / {
        proxy_pass http://quotation_app;
        proxy_http_version 1.1;

        # Headers for proxy
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Keepalive
        proxy_set_header Connection "";
    }

    # Static files — serve directly with caching
    location /assets/ {
        alias /var/www/quotation-app/public/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API rate limiting
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://quotation_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Block sensitive files
    location ~ /\.(env|git|htaccess) {
        deny all;
        return 404;
    }
}
```

### Enable Site

```bash
# Create symlink to enable site
sudo ln -s /etc/nginx/sites-available/quotation-app /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

## SSL/TLS with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate (interactive)
sudo certbot --nginx -d quotation.example.com

# Get certificate (standalone — if no web server yet)
sudo certbot certonly --standalone -d quotation.example.com

# Get wildcard certificate (requires DNS plugin)
sudo apt install python3-certbot-dns-cloudflare
sudo certbot certonly --dns-cloudflare \
    -d "*.example.com" \
    -d "example.com" \
    --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini

# Auto-renew (Certbot installs a cron/timer by default)
sudo systemctl status certbot.timer

# Dry run renewal test
sudo certbot renew --dry-run

# Force renew now
sudo certbot renew --force-renewal

# List certificates
sudo certbot certificates

# Delete certificate
sudo certbot delete --cert-name quotation.example.com
```

## PM2 Process Manager

```bash
# Install
npm install -g pm2

# Start application
pm2 start dist/server.js --name quotation-app

# Start with ecosystem config
pm2 start ecosystem.config.js

# Start in cluster mode (utilize all CPUs)
pm2 start dist/server.js --name quotation-app -i max

# Common commands
pm2 list                        # list processes
pm2 status                      # same as list
pm2 logs quotation-app          # view logs
pm2 logs quotation-app --lines 100  # last 100 lines
pm2 restart quotation-app       # restart
pm2 reload quotation-app        # zero-downtime reload (cluster mode)
pm2 stop quotation-app          # stop
pm2 delete quotation-app        # remove from list
pm2 describe quotation-app      # detailed info
pm2 monit                       # terminal dashboard

# Memory and CPU monitoring
pm2 show quotation-app
pm2 monit

# Startup script (auto-restart on reboot)
pm2 startup systemd
# Run the command it outputs, then:
pm2 save                        # save process list

# Update PM2 without downtime
pm2 update
```

### Ecosystem Config

```javascript
// ecosystem.config.js
module.exports = {
    apps: [{
        name: 'quotation-app',
        script: 'dist/server.js',
        instances: 'max',           // cluster mode — one per CPU core
        exec_mode: 'cluster',
        watch: false,
        max_memory_restart: '512M', // auto-restart on memory leak
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000,
        },
        env_staging: {
            NODE_ENV: 'staging',
            PORT: 3000,
        },
        // Logging
        error_file: '/var/log/pm2/quotation-error.log',
        out_file: '/var/log/pm2/quotation-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,

        // Restart policy
        min_uptime: '10s',
        max_restarts: 10,
        restart_delay: 4000,
        autorestart: true,

        // Graceful shutdown
        kill_timeout: 5000,
        listen_timeout: 10000,
    }],
};
```

## Systemd Services

### Custom Service

```ini
# /etc/systemd/system/quotation-app.service

[Unit]
Description=Quotation Application
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/var/www/quotation-app
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/var/www/quotation-app/.env
ExecStart=/usr/bin/node dist/server.js
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=quotation-app

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/quotation-app/data /var/log/quotation-app
PrivateTmp=true

# Resource limits
LimitNOFILE=65536
MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable quotation-app
sudo systemctl start quotation-app

# Status and logs
sudo systemctl status quotation-app
sudo journalctl -u quotation-app -f                    # follow logs
sudo journalctl -u quotation-app --since "1 hour ago"  # recent logs
sudo journalctl -u quotation-app --since yesterday     # since yesterday

# Restart / reload
sudo systemctl restart quotation-app
sudo systemctl reload quotation-app
```

## Disk Management

```bash
# Disk usage overview
df -h

# Directory sizes (summarized)
du -sh /var/www/*
du -sh /var/log/*

# Find largest files
du -ah / | sort -rh | head -20

# Find files over 100MB
find / -type f -size +100M 2>/dev/null

# Inode usage (running out of inodes = cannot create files)
df -i

# Check specific directory inode usage
find /var/www -xdev -type f | cut -d "/" -f 1-4 | sort | uniq -c | sort -rn | head

# Clean up common space hogs
sudo journalctl --vacuum-size=100M       # trim systemd journals
sudo journalctl --vacuum-time=7d         # keep only 7 days
sudo apt clean                           # clean apt cache
sudo apt autoremove -y                   # remove unused packages
docker system prune -af                  # clean docker (if used)
find /tmp -type f -mtime +7 -delete     # delete old temp files
find /var/log -name "*.gz" -mtime +30 -delete  # delete old rotated logs
```

### Log Rotation

```ini
# /etc/logrotate.d/quotation-app

/var/log/pm2/quotation-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 deploy deploy
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}

# /etc/logrotate.d/nginx is auto-installed with nginx
```

## Backup Strategies

### Database Backup

```bash
#!/bin/bash
# /usr/local/bin/backup-postgres.sh

set -euo pipefail

BACKUP_DIR="/var/backups/postgres"
DB_NAME="quotation_db"
RETENTION_DAYS=14
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

# Dump and compress
pg_dump "$DB_NAME" | gzip > "$BACKUP_FILE"

# Upload to S3 (optional)
# aws s3 cp "$BACKUP_FILE" s3://my-backups/postgres/

# Delete old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed: $BACKUP_FILE"
```

### File Backup

```bash
#!/bin/bash
# /usr/local/bin/backup-app.sh

set -euo pipefail

BACKUP_DIR="/var/backups/app"
APP_DIR="/var/www/quotation-app"
RETENTION_DAYS=14
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/app_${DATE}.tar.gz"

mkdir -p "$BACKUP_DIR"

# Backup app files (exclude node_modules, logs)
tar -czf "$BACKUP_FILE" \
    --exclude='node_modules' \
    --exclude='*.log' \
    --exclude='.env' \
    -C "$(dirname "$APP_DIR")" \
    "$(basename "$APP_DIR")"

# Delete old backups
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed: $BACKUP_FILE"
```

### Encrypted Offsite Backup

```bash
# Encrypt backup with GPG
gpg --symmetric --cipher-algo AES256 \
    --output "${BACKUP_FILE}.gpg" "$BACKUP_FILE"

# Upload encrypted backup
# rsync -avz --progress "${BACKUP_FILE}.gpg" user@backup-server:/backups/
# or
# rclone copy "${BACKUP_FILE}.gpg" remote:backups/

# Decrypt
gpg --decrypt --output "${BACKUP_FILE%.gpg}" "${BACKUP_FILE}.gpg"
```

## Cron Jobs

```bash
# Edit crontab for deploy user
crontab -e

# View current crontab
crontab -l

# ┌───────────── minute (0 - 59)
# │ ┌───────────── hour (0 - 23)
# │ │ ┌───────────── day of month (1 - 31)
# │ │ │ ┌───────────── month (1 - 12)
# │ │ │ │ ┌───────────── day of week (0 - 6, Sun=0)
# │ │ │ │ │
# * * * * * command

# Daily database backup at 2 AM
0 2 * * * /usr/local/bin/backup-postgres.sh >> /var/log/backup.log 2>&1

# Daily app backup at 3 AM
0 3 * * * /usr/local/bin/backup-app.sh >> /var/log/backup.log 2>&1

# Weekly SSL cert check (Certbot has its own timer, this is manual check)
0 0 * * 0 certbot renew --quiet --deploy-hook "systemctl reload nginx"

# Clean old temp files daily at 4 AM
0 4 * * * find /tmp -type f -mtime +7 -delete 2>/dev/null

# Health check every 5 minutes
*/5 * * * * curl -sf http://localhost:3000/health > /dev/null || echo "App down at $(date)" >> /var/log/healthcheck.log
```

## Monitoring

### System Metrics

```bash
# CPU and memory overview
top
htop

# Memory usage
free -h

# Disk I/O
iostat -xz 1

# Network connections
ss -tulpn        # listening ports
ss -tun          # established connections

# Process tree
ps auxf
pstree -p

# System load
uptime
cat /proc/loadavg

# Open files by process
lsof -p $(pgrep -f "node dist/server")
lsof -i :3000    # who's using port 3000

# Real-time disk I/O by process
iotop
```

### Simple Health Check Script

```bash
#!/bin/bash
# /usr/local/bin/healthcheck.sh

ALERT_EMAIL="admin@example.com"
SERVER_NAME="quotation-prod"

check_service() {
    if ! systemctl is-active --quiet "$1"; then
        echo "$1 is DOWN on $SERVER_NAME" | mail -s "ALERT: $1 down" "$ALERT_EMAIL"
        echo "$(date): $1 is DOWN"
    fi
}

check_http() {
    if ! curl -sf -o /dev/null -m 5 "$1"; then
        echo "$1 not responding on $SERVER_NAME" | mail -s "ALERT: HTTP down" "$ALERT_EMAIL"
        echo "$(date): $1 not responding"
    fi
}

check_disk() {
    USAGE=$(df -h "$1" | awk 'NR==2 {print $5}' | tr -d '%')
    if [ "$USAGE" -gt 85 ]; then
        echo "Disk $1 is ${USAGE}% full on $SERVER_NAME" | mail -s "ALERT: Disk space" "$ALERT_EMAIL"
        echo "$(date): Disk $1 is ${USAGE}% full"
    fi
}

check_service quotation-app
check_service nginx
check_service postgresql
check_service redis-server
check_http "http://localhost:3000/health"
check_disk "/"
check_disk "/var"
```

### Node.js App Monitoring

```bash
# PM2 monitoring
pm2 monit                    # terminal dashboard
pm2 show quotation-app       # process details

# Install PM2 metrics (optional)
pm2 install pm2-logrotate    # auto log rotation

# PM2 Plus (SaaS dashboard)
pm2 link <secret> <public>
```

## Deployment Automation

### Deploy Script

```bash
#!/bin/bash
# /usr/local/bin/deploy.sh
set -euo pipefail

APP_DIR="/var/www/quotation-app"
BRANCH="main"
BACKUP_DIR="/var/backups/pre-deploy"

echo "=== Deploy started at $(date) ==="

# Create pre-deploy backup
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf "${BACKUP_DIR}/pre_deploy_${DATE}.tar.gz" \
    --exclude='node_modules' \
    -C "$(dirname "$APP_DIR")" \
    "$(basename "$APP_DIR")" 2>/dev/null || true

# Pull latest code
cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/${BRANCH}"

# Install dependencies
npm ci --production

# Build if needed
npm run build

# Restart application (zero-downtime with PM2)
pm2 reload quotation-app || pm2 restart quotation-app

# Wait for health check
echo "Waiting for health check..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        echo "Health check passed!"
        echo "=== Deploy completed at $(date) ==="
        exit 0
    fi
    sleep 2
done

echo "ERROR: Health check failed! Rolling back..."
# Restore backup
cd "$(dirname "$APP_DIR")"
rm -rf "$APP_DIR"
tar -xzf "${BACKUP_DIR}/pre_deploy_${DATE}.tar.gz"
cd "$APP_DIR"
npm ci --production
pm2 restart quotation-app

echo "Rollback completed."
exit 1
```

### Zero-Downtime Deploy (Blue-Green)

```bash
#!/bin/bash
# blue-green-deploy.sh

APP_DIR="/var/www/quotation-app"
CURRENT_PORT=$(pm2 jlist | jq -r '.[] | select(.name=="quotation-app") .pm2_env.env.PORT' | head -1)

if [ "$CURRENT_PORT" = "3000" ]; then
    NEW_PORT=3001
else
    NEW_PORT=3000
fi

echo "Deploying on port $NEW_PORT..."

# Start new instance on alternate port
PORT=$NEW_PORT pm2 start dist/server.js --name "quotation-app-new" --wait-ready --listen-timeout 10000

# Health check
for i in $(seq 1 30); do
    if curl -sf "http://localhost:${NEW_PORT}/health" > /dev/null 2>&1; then
        break
    fi
    sleep 2
done

# Update Nginx upstream to new port
sudo sed -i "s/server 127.0.0.1:.*/server 127.0.0.1:${NEW_PORT};/" /etc/nginx/sites-available/quotation-app
sudo nginx -t && sudo systemctl reload nginx

# Stop old instance
pm2 stop quotation-app
pm2 delete quotation-app

# Rename new instance
pm2 rename quotation-app-new quotation-app
pm2 save

echo "Blue-green deploy complete — now serving on port $NEW_PORT"
```

## Network Debugging

```bash
# Check listening ports
ss -tulpn | grep LISTEN

# Test HTTP response
curl -I https://quotation.example.com
curl -v http://localhost:3000/health

# DNS lookup
dig quotation.example.com
nslookup quotation.example.com

# Trace route
traceroute quotation.example.com

# Check firewall rules
sudo ufw status verbose
sudo iptables -L -n -v

# Test port connectivity
nc -zv localhost 3000
nc -zv localhost 5432

# Monitor HTTP traffic
tcpdump -i any port 80 -A -s 0

# Check SSL certificate
echo | openssl s_client -connect quotation.example.com:443 -servername quotation.example.com 2>/dev/null | openssl x509 -noout -dates -subject

# DNS propagation check
for ns in 8.8.8.8 1.1.1.1 9.9.9.9; do
    echo "--- $ns ---"
    dig @"$ns" quotation.example.com +short
done
```

## Performance Tuning

```bash
# System limits — /etc/security/limits.conf
deploy soft nofile 65536
deploy hard nofile 65536
deploy soft nproc 4096
deploy hard nproc 4096

# Kernel tuning — /etc/sysctl.conf
# Increase file descriptors
fs.file-max = 65536

# TCP tuning
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 1024
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535

# Swap
vm.swappiness = 10

# Apply sysctl changes
sudo sysctl -p

# Node.js optimization
# --max-old-space-size=512    # limit heap to 512MB
# --optimize-for-size         # reduce memory at cost of speed
# --gc-interval=100           # run GC every 100 allocations

# In PM2 ecosystem:
# node_args: ['--max-old-space-size=512']
```

## Quick Reference — Essential Commands

```bash
# System info
uname -a                          # kernel version
lsb_release -a                    # OS version
uptime                            # uptime and load
free -h                           # memory
df -h                             # disk space
lscpu                             # CPU info

# Process management
ps aux | grep node                 # find node processes
kill -15 <PID>                    # graceful stop
kill -9 <PID>                     # force kill
pkill -f "node dist/server"       # kill by pattern

# File operations
tail -f /var/log/syslog           # follow log
grep -r "error" /var/log/nginx/   # search logs
wc -l /var/log/nginx/access.log   # count lines
tar -czf backup.tar.gz /path/     # compress
tar -xzf backup.tar.gz            # extract

# Network
ip addr show                      # IP addresses
ip route show                     # routing table
ping -c 4 8.8.8.8                # connectivity test
wget -q -O - ifconfig.me          # public IP

# Service management
systemctl list-units --type=service --state=running
journalctl -u nginx --since "1 hour ago" -f
```

## Code Style Rules

- Disable SSH password authentication and root login — use key-based auth only.
- Set up UFW firewall with deny-all default — only open ports you explicitly need.
- Run applications under a dedicated user (not root) with minimal permissions.
- Use Nginx as reverse proxy — terminate TLS at Nginx, proxy to Node.js on localhost.
- Enable SSL with Certbot and configure auto-renewal — use TLS 1.2+ only.
- Use PM2 in cluster mode (`-i max`) for production Node.js apps — utilize all CPU cores.
- Configure `max_memory_restart` in PM2 to auto-restart on memory leaks.
- Set up log rotation for all application and system logs — prevent disk fill.
- Automate database and file backups with cron — test restore periodically.
- Use `pm2 reload` for zero-downtime deploys (cluster mode) — not `restart`.
- Harden systemd services with `NoNewPrivileges`, `ProtectSystem`, `PrivateTmp`.
- Monitor disk usage and set alerts at 85% threshold — never let disks reach 100%.
- Keep a pre-deploy backup and implement rollback in deploy scripts.
- Use `set -euo pipefail` in all shell scripts — fail fast on errors.
- Pin Node.js version with nvm or NodeSource — avoid unexpected major version upgrades.
