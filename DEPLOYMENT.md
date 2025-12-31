# RPG Game - Deployment Guide

**Version:** 1.0.0
**Last Updated:** 2025-12-31

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Server Deployment](#server-deployment)
5. [Web App Deployment](#web-app-deployment)
6. [Desktop App Distribution](#desktop-app-distribution)
7. [Mobile App Distribution](#mobile-app-distribution)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Node.js**: v18+ or **Bun**: v1.0+
- **PostgreSQL**: v14+
- **Git**: Latest version
- **Docker** (optional): For containerized deployment

### For Desktop Builds
- **Electron Builder** dependencies
- **Windows**: Visual Studio Build Tools
- **macOS**: Xcode Command Line Tools
- **Linux**: build-essential

### For Mobile Builds
- **iOS**: macOS with Xcode 14+
- **Android**: Android Studio with SDK 33+
- **Capacitor CLI**: v5+

---

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/rpg.git
cd rpg
```

### 2. Install Dependencies
```bash
# Using Bun (recommended)
bun install

# Or using npm
npm install
```

### 3. Configure Environment Variables

Create `.env` files for each app:

**apps/server/.env:**
```env
# Server Configuration
NODE_ENV=production
PORT=3000
WS_PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rpg_game
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rpg_game
DB_USER=rpg_user
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRES_IN=7d

# TURN Server (for WebRTC)
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_USERNAME=username
TURN_PASSWORD=password

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**apps/web/.env:**
```env
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com:3001
VITE_TURN_SERVER=turn:your-turn-server.com:3478
```

---

## Database Setup

### 1. Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE rpg_game;
CREATE USER rpg_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE rpg_game TO rpg_user;
\q
```

### 2. Initialize Schema
```bash
cd apps/server
bun run src/database/init.ts
```

### 3. Verify Setup
```bash
psql -U rpg_user -d rpg_game -c "SELECT COUNT(*) FROM players;"
```

---

## Server Deployment

### Option 1: Direct Deployment (PM2)

**1. Build Server:**
```bash
cd apps/server
bun run build
```

**2. Install PM2:**
```bash
npm install -g pm2
```

**3. Create PM2 Ecosystem File:**

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'rpg-server',
      script: './dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        WS_PORT: 3001,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
```

**4. Start Server:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Option 2: Docker Deployment

**1. Create Dockerfile:**
```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY . .

# Build
RUN bun run build

# Expose ports
EXPOSE 3000 3001

# Start
CMD ["bun", "run", "dist/index.js"]
```

**2. Create docker-compose.yml:**
```yaml
version: '3.8'
services:
  db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: rpg_game
      POSTGRES_USER: rpg_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  server:
    build: ./apps/server
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://rpg_user:${DB_PASSWORD}@db:5432/rpg_game
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3000:3000"
      - "3001:3001"
    restart: unless-stopped

volumes:
  postgres_data:
```

**3. Deploy:**
```bash
docker-compose up -d
```

### Option 3: Cloud Platform (Heroku, DigitalOcean, AWS)

**Heroku:**
```bash
heroku create rpg-game-server
heroku addons:create heroku-postgresql:hobby-dev
git push heroku main
```

**DigitalOcean App Platform:**
- Connect GitHub repository
- Set environment variables in dashboard
- Enable auto-deploy on push

---

## Web App Deployment

### Option 1: Static Hosting (Vercel, Netlify)

**1. Build:**
```bash
cd apps/web
bun run build
```

**2. Deploy to Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**3. Deploy to Netlify:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### Option 2: Self-Hosted (Nginx)

**1. Build:**
```bash
cd apps/web
bun run build
```

**2. Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/rpg/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket Proxy
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

**3. Enable HTTPS with Let's Encrypt:**
```bash
sudo certbot --nginx -d yourdomain.com
```

---

## Desktop App Distribution

### Windows Build

**1. Build:**
```bash
cd apps/desktop
bun run dist:win
```

**2. Sign (Optional but Recommended):**
```bash
# Install signtool (Windows SDK)
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com release/RPG-Setup-1.0.0.exe
```

**3. Distribute:**
- Upload to GitHub Releases
- Host on your website
- Submit to Microsoft Store (optional)

### macOS Build

**1. Build:**
```bash
cd apps/desktop
bun run dist:mac
```

**2. Sign and Notarize:**
```bash
# Sign
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" release/RPG-1.0.0.dmg

# Notarize
xcrun altool --notarize-app --primary-bundle-id "com.yourcompany.rpg" --username "your@email.com" --password "@keychain:AC_PASSWORD" --file release/RPG-1.0.0.dmg
```

**3. Distribute:**
- Upload to GitHub Releases
- Host on your website
- Submit to Mac App Store (optional)

### Linux Build

**1. Build:**
```bash
cd apps/desktop
bun run dist:linux
```

**2. Distribute:**
- Upload to GitHub Releases
- Submit to Snap Store
- Submit to Flathub

---

## Mobile App Distribution

### iOS App

**1. Prerequisites:**
- Apple Developer Account ($99/year)
- Certificates and Provisioning Profiles

**2. Build:**
```bash
cd apps/mobile
bun run build:ios
```

**3. Open in Xcode:**
```bash
bun run open:ios
```

**4. In Xcode:**
- Set your Team and Bundle Identifier
- Archive: Product > Archive
- Distribute: Window > Organizer > Distribute App

**5. Submit to App Store:**
- Upload via Xcode Organizer
- Complete app information in App Store Connect
- Submit for review

### Android App

**1. Prerequisites:**
- Google Play Developer Account ($25 one-time)
- Keystore for signing

**2. Create Keystore:**
```bash
keytool -genkey -v -keystore release.keystore -alias rpg-key -keyalg RSA -keysize 2048 -validity 10000
```

**3. Build:**
```bash
cd apps/mobile
bun run build:android
```

**4. Sign APK/AAB:**
```bash
cd android
./gradlew bundleRelease
```

**5. Submit to Google Play:**
- Upload AAB to Google Play Console
- Complete app information
- Submit for review

---

## Monitoring & Maintenance

### Server Monitoring

**1. Install Monitoring Tools:**
```bash
# PM2 Monitoring
pm2 install pm2-logrotate

# System monitoring
sudo apt install htop iotop nethogs
```

**2. Setup Logging:**
```bash
# PM2 logs
pm2 logs rpg-server

# Application logs
tail -f apps/server/logs/app.log
```

**3. Health Checks:**
```bash
# Server health
curl https://api.yourdomain.com/health

# Database health
psql -U rpg_user -d rpg_game -c "SELECT 1;"
```

### Database Backup

**1. Automated Backups:**
```bash
# Create backup script
cat > /etc/cron.daily/rpg-backup << 'EOF'
#!/bin/bash
pg_dump -U rpg_user rpg_game | gzip > /backups/rpg_$(date +%Y%m%d).sql.gz
# Keep only last 30 days
find /backups -name "rpg_*.sql.gz" -mtime +30 -delete
EOF

chmod +x /etc/cron.daily/rpg-backup
```

**2. Manual Backup:**
```bash
pg_dump -U rpg_user rpg_game > backup.sql
```

**3. Restore:**
```bash
psql -U rpg_user rpg_game < backup.sql
```

### Performance Monitoring

**1. Server Metrics:**
- CPU usage
- Memory usage
- Network I/O
- Database connections

**2. Application Metrics:**
- Active users
- WebRTC connections
- API response times
- Error rates

**3. Tools:**
- **New Relic** or **DataDog** for APM
- **Grafana + Prometheus** for metrics
- **Sentry** for error tracking

---

## Troubleshooting

### Common Issues

**1. Database Connection Failed:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection string
psql postgresql://rpg_user:password@localhost:5432/rpg_game
```

**2. WebSocket Connection Failed:**
- Check firewall rules for port 3001
- Verify WS_PORT environment variable
- Check CORS settings

**3. High Memory Usage:**
```bash
# Restart server
pm2 restart rpg-server

# Check memory leaks
node --inspect dist/index.js
```

**4. Slow API Response:**
- Check database indexes
- Enable query logging
- Use connection pooling
- Add Redis caching

**5. WebRTC Connection Issues:**
- Verify TURN server configuration
- Check NAT traversal settings
- Monitor STUN/TURN server logs

### Getting Help

- **Documentation:** Check this guide and code comments
- **Logs:** Review server and application logs
- **GitHub Issues:** Report bugs and request features
- **Community:** Join our Discord/Forum

---

## Security Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Use strong JWT secret (32+ characters)
- [ ] Enable HTTPS/WSS
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up firewall rules
- [ ] Keep dependencies updated
- [ ] Enable database backups
- [ ] Set up monitoring and alerts
- [ ] Review and audit code
- [ ] Test disaster recovery plan

---

## Post-Launch Checklist

- [ ] Monitor error rates
- [ ] Track user registrations
- [ ] Check server performance
- [ ] Verify database backups
- [ ] Monitor costs (if cloud)
- [ ] Respond to user feedback
- [ ] Plan updates and patches
- [ ] Marketing and promotion

---

**For questions or issues, contact:** support@yourdomain.com
