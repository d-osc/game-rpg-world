---
name: network
description: Network infrastructure — DNS management (Cloudflare, Route53), tunneling (Cloudflare Tunnel, SSH tunnel, ngrok), firewall configuration (UFW, iptables, Nginx), VPN setup, TLS/mTLS, private networking, port forwarding, and network troubleshooting
---

# Network (DNS, Tunnel, Firewall)

## DNS Management

### DNS Record Types

```
# Common DNS record types

A       — IPv4 address
    example.com.        A       203.0.113.10

AAAA    — IPv6 address
    example.com.        AAAA    2001:db8::1

CNAME   — Alias to another domain
    www.example.com.    CNAME   example.com.
    app.example.com.    CNAME   quotation.herokuapp.com.

MX      — Mail exchange
    example.com.        MX      10 mail.example.com.

TXT     — Text data (SPF, DKIM, verification)
    example.com.        TXT     "v=spf1 include:_spf.google.com ~all"
    _dmarc.example.com. TXT     "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"

NS      — Nameserver
    example.com.        NS      ns1.cloudflare.com.
    example.com.        NS      ns2.cloudflare.com.

SRV     — Service locator
    _sip._tcp.example.com. SRV  10 60 5060 sip.example.com.

CAA     — Certificate Authority Authorization
    example.com.        CAA     0 issue "letsencrypt.org"

SOA     — Start of Authority (auto-managed by DNS provider)
```

### Cloudflare DNS via API

```bash
# Cloudflare API — manage DNS records

# Get zone ID
curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=example.com" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" | jq '.result[0].id'

# Create A record
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{
        "type": "A",
        "name": "quotation.example.com",
        "content": "203.0.113.10",
        "ttl": 1,
        "proxied": true
    }' | jq '.success'

# Create CNAME
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{
        "type": "CNAME",
        "name": "app.example.com",
        "content": "quotation.example.com",
        "ttl": 1,
        "proxied": true
    }' | jq '.success'

# List all DNS records
curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" | jq '.result[] | {type, name, content, proxied}'

# Update DNS record (e.g., change IP)
curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{
        "type": "A",
        "name": "quotation.example.com",
        "content": "203.0.113.20",
        "ttl": 1,
        "proxied": true
    }' | jq '.success'

# Delete DNS record
curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
    -H "Authorization: Bearer $CF_API_TOKEN" | jq '.success'
```

### Dynamic DNS (DDNS)

```bash
#!/bin/bash
# /usr/local/bin/ddns-update.sh
# Update Cloudflare DNS when public IP changes

set -euo pipefail

ZONE_ID="your-zone-id"
RECORD_ID="your-record-id"
DOMAIN="quotation.example.com"
CF_TOKEN="$CLOUDFLARE_API_TOKEN"

# Get current public IP
CURRENT_IP=$(curl -sf https://api.ipify.org)

# Get DNS record IP
DNS_IP=$(curl -sf -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
    -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result.content')

if [ "$CURRENT_IP" != "$DNS_IP" ]; then
    echo "IP changed: $DNS_IP → $CURRENT_IP — updating DNS"
    curl -sf -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
        -H "Authorization: Bearer $CF_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{\"type\":\"A\",\"name\":\"$DOMAIN\",\"content\":\"$CURRENT_IP\",\"ttl\":1,\"proxied\":true}" \
        | jq '.success'
else
    echo "IP unchanged: $CURRENT_IP"
fi
```

```bash
# Run every 5 minutes via cron
*/5 * * * * /usr/local/bin/ddns-update.sh >> /var/log/ddns.log 2>&1
```

### DNS Troubleshooting

```bash
# Query specific DNS server
dig @8.8.8.8 quotation.example.com
dig @1.1.1.1 quotation.example.com CNAME
dig +short quotation.example.com     # short answer only

# Trace DNS resolution path
dig +trace quotation.example.com

# Reverse DNS lookup
dig -x 203.0.113.10

# Check DNS propagation across multiple servers
for ns in 8.8.8.8 1.1.1.1 9.9.9.9 208.67.222.222; do
    echo -n "$ns: "
    dig @"$ns" +short quotation.example.com
done

# DNSSEC validation
dig +dnssec quotation.example.com

# Check all record types
dig quotation.example.com ANY

# nslookup (Windows-compatible)
nslookup quotation.example.com 8.8.8.8

# host (simpler output)
host quotation.example.com
host -t MX example.com
host -t TXT example.com

# Flush local DNS cache
# Linux (systemd-resolved)
sudo resolvectl flush-caches
# macOS
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
# Windows
ipconfig /flushdns
```

## Tunnels

### Cloudflare Tunnel (cloudflared)

```bash
# Install cloudflared
# Debian/Ubuntu
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# macOS
brew install cloudflared

# Windows
winget install --id Cloudflare.cloudflared

# Authenticate (opens browser)
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create quotation-app
# Note the tunnel ID from output

# List tunnels
cloudflared tunnel list
```

#### Tunnel Configuration

```yaml
# ~/.cloudflared/config.yml

tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
    # Route quotation.example.com → localhost:3000
    - hostname: quotation.example.com
      service: http://localhost:3000

    # Route api.example.com → localhost:3000
    - hostname: api.example.com
      service: http://localhost:3000

    # WebSocket support (automatic)
    - hostname: ws.example.com
      service: ws://localhost:3000

    # SSH access via browser
    - hostname: ssh.example.com
      service: ssh://localhost:22

    # Catch-all (required)
    - service: http_status:404
```

```bash
# Create DNS record for tunnel
cloudflared tunnel route dns quotation-app quotation.example.com

# Run tunnel (foreground)
cloudflared tunnel run quotation-app

# Run as service (auto-start on boot)
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Check status
sudo systemctl status cloudflared
cloudflared tunnel info quotation-app
```

#### Quick Tunnel (Temporary, No Config)

```bash
# One-command tunnel — generates a random trycloudflare.com subdomain
cloudflared tunnel --url http://localhost:3000
# Output: https://random-name.trycloudflare.com

# Useful for quick demos and testing
```

### SSH Tunnel

```bash
# Local port forwarding — access remote service as if it were local
# ssh -L [local_port]:[remote_host]:[remote_port] [user@server]

# Forward local:5432 → remote PostgreSQL
ssh -L 5432:localhost:5432 deploy@203.0.113.10 -N

# Forward local:6379 → remote Redis
ssh -L 6379:localhost:6379 deploy@203.0.113.10 -N

# Forward local:8080 → internal web app (via bastion)
ssh -L 8080:10.0.1.50:3000 admin@bastion.example.com -N

# Access remote resource behind firewall
ssh -L 8888:internal-service.local:80 deploy@server -N
# Then browse http://localhost:8888

# Remote port forwarding — expose local service to remote network
# ssh -R [remote_port]:[local_host]:[local_port] [user@server]

# Expose local dev server to remote
ssh -R 3000:localhost:3000 deploy@server -N

# Dynamic port forwarding (SOCKS proxy)
ssh -D 1080 deploy@server -N
# Then configure browser/OS to use SOCKS5 proxy at localhost:1080

# Jump via intermediate host
ssh -J bastion.example.com internal-server.local

# Keep tunnel alive
ssh -L 5432:localhost:5432 -o ServerAliveInterval=60 -o ServerAliveCountMax=3 deploy@server -N

# Background tunnel
ssh -f -N -L 5432:localhost:5432 deploy@server

# Autossh — auto-reconnecting SSH tunnel
autossh -M 0 -f -N -L 5432:localhost:5432 \
    -o "ServerAliveInterval=30" \
    -o "ServerAliveCountMax=3" \
    -o "ExitOnForwardFailure=yes" \
    deploy@server
```

### Ngrok (Quick Tunnel)

```bash
# Install
# macOS
brew install ngrok
# Linux
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc > /dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Authenticate
ngrok config add-authtoken YOUR_TOKEN

# Expose local port
ngrok http 3000
# Output: https://abc123.ngrok-free.app → http://localhost:3000

# With custom domain (paid plan)
ngrok http --domain=dev.example.com 3000

# TCP tunnel (database, SSH)
ngrok tcp 5432    # PostgreSQL
ngrok tcp 22      # SSH

# Tunnel with auth
ngrok http --auth="user:password" 3000

# Inspect traffic at http://127.0.0.1:4040
```

## Firewall

### UFW (Ubuntu/Debian)

```bash
# Install and enable
sudo apt install ufw
sudo ufw enable

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (DO THIS FIRST before enabling!)
sudo ufw allow 22/tcp comment 'SSH'

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Allow from specific IP only
sudo ufw allow from 203.0.113.50 to any port 22 proto tcp comment 'Office SSH'

# Allow subnet
sudo ufw allow from 10.0.0.0/8 to any port 5432 proto tcp comment 'Internal PostgreSQL'

# Allow port range
sudo ufw allow 3000:3010/tcp comment 'App ports'

# Rate limit SSH (max 6 connections in 30s per IP)
sudo ufw limit 22/tcp comment 'SSH rate-limited'

# Deny specific IP
sudo ufw deny from 1.2.3.4 comment 'Blocked attacker'

# Delete rule
sudo ufw delete allow 80/tcp
# or by number
sudo ufw status numbered
sudo ufw delete 3

# View status
sudo ufw status verbose
sudo ufw status numbered

# Reset all rules
sudo ufw reset

# Reload after manual config edits
sudo ufw reload
```

### UFW Application Profiles

```bash
# /etc/ufw/applications.d/quotation-app
[QuotationApp]
title=Quotation Application
description=Quotation management web application
ports=3000/tcp

[QuotationApp-Full]
title=Quotation App (Full)
description=App with WebSocket support
ports=3000:3001/tcp
```

```bash
sudo ufw app update QuotationApp
sudo ufw allow QuotationApp
sudo ufw app info QuotationApp
```

### iptables (Advanced)

```bash
# View rules
sudo iptables -L -n -v
sudo iptables -L -n -v --line-numbers

# Default policies
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT

# Allow loopback
sudo iptables -A INPUT -i lo -j ACCEPT

# Allow established connections
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Allow SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow from specific IP
sudo iptables -A INPUT -s 10.0.0.0/8 -p tcp --dport 5432 -j ACCEPT

# Rate limit SSH (max 3 new connections per 30s)
sudo iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW \
    -m recent --set --name ssh
sudo iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW \
    -m recent --update --seconds 30 --hitcount 4 --name ssh -j DROP
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Block specific IP
sudo iptables -A INPUT -s 1.2.3.4 -j DROP

# Log dropped packets
sudo iptables -A INPUT -j LOG --log-prefix "IPTables-Dropped: " --log-level 4

# Allow ICMP (ping)
sudo iptables -A INPUT -p icmp --icmp-type echo-request -j ACCEPT

# Save rules (persist across reboot)
sudo apt install iptables-persistent
sudo netfilter-persistent save
sudo netfilter-persistent reload

# Delete rule by number
sudo iptables -D INPUT 5
# or flush all
sudo iptables -F
```

### Nginx as Firewall

```nginx
# Block by IP in Nginx
location /admin/ {
    allow 203.0.113.0/24;    # office
    allow 10.0.0.0/8;         # VPN
    deny all;

    proxy_pass http://app_backend;
}

# Block by User-Agent
if ($http_user_agent ~* (sqlmap|nikto|nmap|malicious)) {
    return 403;
}

# Block specific request patterns
location ~* \.(env|git|htaccess|bak|sql|log|swp)$ {
    deny all;
    return 404;
}

# Block by country (GeoIP)
# apt install libnginx-mod-http-geoip2
# Requires MaxMind GeoLite2 database

# Rate limiting at firewall level
limit_req_zone $binary_remote_addr zone=global:10m rate=30r/m;

server {
    limit_req zone=global burst=50 nodelay;
}
```

## VPN & Private Networking

### WireGuard VPN

```bash
# Install
sudo apt install wireguard

# Generate keys (on server)
wg genkey | tee server_private.key | wg pubkey > server_public.key

# Generate keys (on client)
wg genkey | tee client_private.key | wg pubkey > client_public.key
```

```ini
# /etc/wireguard/wg0.conf (Server)

[Interface]
PrivateKey = <server_private_key>
Address = 10.0.0.1/24
ListenPort = 51820

# PostUp = iptables rules for forwarding
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
# Client 1
PublicKey = <client_public_key>
AllowedIPs = 10.0.0.2/32
```

```ini
# /etc/wireguard/wg0.conf (Client)

[Interface]
PrivateKey = <client_private_key>
Address = 10.0.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = <server_public_key>
Endpoint = 203.0.113.10:51820
AllowedIPs = 10.0.0.0/24    # only route VPN traffic
# AllowedIPs = 0.0.0.0/0   # route ALL traffic through VPN
PersistentKeepalive = 25
```

```bash
# Start VPN
sudo wg-quick up wg0

# Stop VPN
sudo wg-quick down wg0

# Enable on boot
sudo systemctl enable wg-quick@wg0

# Check status
sudo wg show
```

### Tailscale (Zero-Config VPN)

```bash
# Install
curl -fsSL https://tailscale.com/install.sh | sh

# Authenticate
sudo tailscale up

# Get status
tailscale status

# Access other machines by Tailscale IP
ssh deploy@100.x.y.z

# Use MagicDNS (hostnames instead of IPs)
ssh deploy@quotation-server

# Serve a local service to your tailnet
tailscale serve 3000
# Now accessible at https://your-machine.tail-xxxxx.ts.net

# Funnel — expose to the public internet
tailscale funnel 3000

# Disable when done
sudo tailscale down
```

### Private Network (Cloud VPC)

```bash
# DigitalOcean — private networking
# Enable in dashboard or via API
# Each droplet gets a private IP (10.x.x.x)

# Use private IP for inter-server communication
# app server → database server via private IP (no internet, no charges)

# /etc/hosts on each server
10.0.1.10    app-server
10.0.1.11    db-primary
10.0.1.12    db-replica
10.0.1.13    redis

# Only expose app server's public IP
# Database and Redis listen on private IP only
```

```ini
# PostgreSQL — listen only on private IP
# /etc/postgresql/16/main/postgresql.conf
listen_addresses = '10.0.1.11'

# /etc/postgresql/16/main/pg_hba.conf
# Allow connections from app server only
host    quotation_prod    app_user    10.0.1.10/32    md5
```

```bash
# Redis — bind to private IP only
# /etc/redis/redis.conf
bind 10.0.1.13
```

## TLS / mTLS

### Self-Signed Certificate (Internal Services)

```bash
# Generate CA key and certificate
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.crt \
    -subj "/C=TH/ST=Bangkok/O=MyOrg/CN=My Internal CA"

# Generate server certificate
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr \
    -subj "/C=TH/ST=Bangkok/O=MyOrg/CN=internal.example.com"

# Sign with CA
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
    -out server.crt -days 365 -sha256

# Verify
openssl verify -CAfile ca.crt server.crt
```

### mTLS (Mutual TLS) — Client Certificate Auth

```nginx
# Nginx — require client certificate
server {
    listen 443 ssl;
    server_name api-internal.example.com;

    ssl_certificate     /etc/ssl/server.crt;
    ssl_certificate_key /etc/ssl/server.key;

    # Require client certificate
    ssl_client_certificate /etc/ssl/ca.crt;
    ssl_verify_client on;
    ssl_verify_depth 2;

    location / {
        # Pass client cert info to backend
        proxy_set_header X-Client-DN $ssl_client_s_dn;
        proxy_set_header X-Client-Verify $ssl_client_verify;
        proxy_pass http://app_backend;
    }
}
```

```bash
# Generate client certificate
openssl genrsa -out client1.key 2048
openssl req -new -key client1.key -out client1.csr \
    -subj "/C=TH/ST=Bangkok/O=MyOrg/CN=Service-A"
openssl x509 -req -in client1.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
    -out client1.crt -days 365 -sha256

# Test with curl
curl --cert client1.crt --key client1.key --cacert ca.crt \
    https://api-internal.example.com/health
```

## Port Forwarding

### NAT Port Forwarding

```bash
# Forward external port 8080 → internal 10.0.1.50:3000
sudo iptables -t nat -A PREROUTING -p tcp --dport 8080 -j DNAT --to-destination 10.0.1.50:3000
sudo iptables -t nat -A POSTROUTING -j MASQUERADE

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Save rules
sudo netfilter-persistent save
```

### Local Port Forwarding (socat)

```bash
# Forward local:8080 → remote:3000
socat TCP-LISTEN:8080,fork TCP:10.0.1.50:3000

# Forward local:5432 → remote PostgreSQL
socat TCP-LISTEN:5432,reuseaddr,fork TCP:db.internal:5432

# UDP forward
socat UDP-LISTEN:5353,fork UDP:10.0.1.50:5353
```

## Network Troubleshooting

### Connectivity

```bash
# Test TCP connectivity
nc -zv quotation.example.com 443
nc -zv db.internal 5432
nc -zv redis.internal 6379

# Test with timeout
nc -zv -w 5 quotation.example.com 443

# Check listening ports
ss -tulpn | grep LISTEN
ss -tulpn | grep :3000

# Check established connections
ss -tn | grep :3000
ss -tn state established

# Network interfaces
ip addr show
ip link show

# Routing table
ip route show
ip route get 8.8.8.8

# Traceroute
traceroute quotation.example.com
mtr quotation.example.com    # continuous traceroute

# Bandwidth test
iperf3 -s    # server
iperf3 -c server-ip    # client

# Check public IP
curl -sf https://api.ipify.org
curl -sf https://ifconfig.me
curl -sf https://checkip.amazonaws.com

# Check all IPs (including private)
hostname -I
```

### HTTP Debugging

```bash
# Verbose HTTP request
curl -vI https://quotation.example.com

# Check headers only
curl -sI https://quotation.example.com

# Check redirect chain
curl -sIL https://quotation.example.com

# Check specific response header
curl -sI https://quotation.example.com | grep -i "strict-transport"

# Check SSL certificate details
curl -vI https://quotation.example.com 2>&1 | grep -E "SSL|subject|issuer|expire|CN"

# Test HTTP/2
curl -I --http2 https://quotation.example.com

# Send via specific IP (test before DNS switch)
curl --resolve quotation.example.com:443:203.0.113.10 https://quotation.example.com/health

# Time breakdown
curl -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nStart: %{time_starttransfer}s\nTotal: %{time_total}s\n" \
    -o /dev/null -s https://quotation.example.com
```

### Packet Capture

```bash
# Capture HTTP traffic on port 80
sudo tcpdump -i any port 80 -A -s 0

# Capture traffic to/from specific host
sudo tcpdump -i any host 10.0.1.50

# Capture and save to file
sudo tcpdump -i any port 443 -w capture.pcap

# Read capture file
sudo tcpdump -r capture.pcap

# Filter by port and host
sudo tcpdump -i eth0 -nn -vvv port 443 and host 203.0.113.10

# Monitor DNS queries
sudo tcpdump -i any port 53 -nn
```

### MTR Report

```bash
# Continuous traceroute with packet loss stats
mtr --report --report-cycles 10 quotation.example.com

# Output shows hop-by-hop latency and packet loss
# Useful for identifying where connectivity issues occur
```

## Network Architecture Diagram

```
                    Internet
                       │
                ┌──────┴──────┐
                │  Cloudflare │  CDN + DDoS + WAF
                │   (Proxy)   │
                └──────┬──────┘
                       │
              ┌────────┴────────┐
              │   Nginx/Caddy   │  TLS termination
              │  (Reverse Proxy)│  Rate limiting
              └────┬───────┬────┘
                   │       │
            ┌──────┴──┐ ┌──┴──────┐
            │  App #1 │ │  App #2 │  PM2 cluster or Docker
            │  :3000  │ │  :3000  │
            └────┬────┘ └────┬────┘
                 │           │
        ┌────────┴───────────┴────────┐
        │                             │
   ┌────┴─────┐                ┌──────┴──────┐
   │ PostgreSQL│                │    Redis    │
   │ (Primary) │                │  (Sentinel) │
   └────┬─────┘                └─────────────┘
        │
   ┌────┴──────────┐
   │ PgBouncer     │  Connection pooling
   │ :6432         │
   └───────────────┘

Private Network (10.0.0.0/8):
  - App ↔ DB: private IPs only
  - App ↔ Redis: private IPs only
  - No public internet access to DB/Redis
```

## Code Style Rules

- Use Cloudflare Tunnel (cloudflared) for secure exposure — no need to open ports or manage firewall rules for inbound traffic.
- Always allow SSH (port 22) before enabling UFW — lockout prevention.
- Set UFW default to deny incoming — only open ports explicitly needed.
- Use private networking for inter-server communication — database, Redis, internal APIs should never be publicly accessible.
- Configure rate limiting on SSH (`ufw limit 22/tcp`) — prevent brute-force attacks.
- Use `iptables-persistent` to save firewall rules — rules are lost on reboot without it.
- Use Cloudflare as DNS proxy (orange cloud) — get DDoS protection, WAF, and CDN for free.
- Use SSH tunnels for temporary secure access to internal services — no VPN needed for quick access.
- Implement mTLS for internal service-to-service communication — mutual certificate verification.
- Keep DNS TTL low (300s) during migrations — fast failover; raise (3600s) in steady state.
- Enable IP forwarding only when NAT/port forwarding is needed — disable by default for security.
- Monitor DNS propagation after changes — verify across multiple resolvers before declaring done.
- Use WireGuard or Tailscale for site-to-site VPN — simpler and faster than OpenVPN/IPSec.
- Always test firewall changes from a separate session — prevent accidental lockout.
- Bind internal services (PostgreSQL, Redis) to private IP only — never 0.0.0.0 for backend services.
