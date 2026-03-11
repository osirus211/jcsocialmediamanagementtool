# Blue-Green Deployment Guide

This directory contains the complete blue-green deployment infrastructure for the social media management platform.

## 🏗️ Architecture Overview

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    │     (Nginx)     │
                    └─────────┬───────┘
                              │
                    ┌─────────▼───────┐
                    │  Active Slot    │
                    │  (Blue/Green)   │
                    └─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌─────▼─────┐         ┌─────▼─────┐
   │  Blue   │          │  Shared   │         │  Green    │
   │  Slot   │          │ Services  │         │   Slot    │
   │         │          │           │         │           │
   │API:3001 │◄─────────┤ MongoDB   │─────────►│API:3002   │
   │Web:4001 │          │ Redis     │         │Web:4002   │
   └─────────┘          └───────────┘         └───────────┘
```

### Slot Configuration

**Blue Slot (Default Active):**
- Backend API: `localhost:3001`
- Frontend: `localhost:4001`
- Health Check: `localhost:8001`

**Green Slot (Inactive):**
- Backend API: `localhost:3002`
- Frontend: `localhost:4002`
- Health Check: `localhost:8002`

**Shared Services:**
- MongoDB: `localhost:27017`
- Redis: `localhost:6379`

## 🚀 Deployment Process

### Automated Deployment (GitHub Actions)

1. **Trigger**: Push to `main` branch or manual workflow dispatch
2. **Build**: Create Docker images and push to registry
3. **Deploy**: Deploy to inactive slot
4. **Health Check**: Verify inactive slot is healthy
5. **Switch**: Route traffic to inactive slot
6. **Verify**: Confirm production health
7. **Cleanup**: Stop old slot

### Manual Deployment

```bash
# 1. Deploy to inactive slot
cd /opt/social-media-app
export BACKEND_IMAGE=your-backend:latest
export FRONTEND_IMAGE=your-frontend:latest

# Deploy to green slot (if blue is active)
docker-compose -f deployment/blue-green/docker-compose.green.yml up -d

# 2. Health check
./deployment/blue-green/health-check.sh http://localhost:3002

# 3. Switch traffic
./deployment/blue-green/switch-slot.sh green

# 4. Stop old slot
docker-compose -f deployment/blue-green/docker-compose.blue.yml down
```

## 🏥 Health Check Endpoints

### Application Health
- **Primary**: `GET /api/v1/health`
- **Detailed**: `GET /api/v1/health/detailed`
- **Response Format**:
  ```json
  {
    "status": "ok",
    "slot": "blue",
    "version": "1.0.0",
    "timestamp": "2024-03-11T18:00:00Z"
  }
  ```

### Nginx Health
- **Nginx Status**: `GET /nginx-health`
- **Load Balancer**: `GET /lb-health`
- **Blue Slot**: `GET :8001/health`
- **Green Slot**: `GET :8002/health`

## 🔄 Slot Management

### Switch Slots
```bash
# Switch to blue slot
./deployment/blue-green/switch-slot.sh blue

# Switch to green slot
./deployment/blue-green/switch-slot.sh green
```

### Check Current Slot
```bash
curl -s localhost/api/v1/health | jq '.slot'
```

### Rollback
```bash
# Automatic rollback to previous slot
./deployment/blue-green/rollback.sh

# Force rollback (even if target unhealthy)
./deployment/blue-green/rollback.sh --force
```

## 🔧 Setup Instructions

### 1. Server Prerequisites

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create application directory
sudo mkdir -p /opt/social-media-app
cd /opt/social-media-app
```

### 2. Network and Volume Setup

```bash
# Create external network
docker network create app-network

# Create external volumes
docker volume create mongodb_data
docker volume create mongodb_config
docker volume create redis_data
```

### 3. Environment Configuration

```bash
# Copy environment file
cp .env.production.example .env.production

# Edit environment variables
nano .env.production
```

Required environment variables:
```bash
# Database
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your-secure-password
MONGO_DATABASE=social_media_app
REDIS_PASSWORD=your-redis-password

# Application
NODE_ENV=production
JWT_SECRET=your-jwt-secret
API_URL=https://your-domain.com

# External Services
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
# ... other OAuth credentials
```

### 4. Nginx Configuration

```bash
# Install Nginx
sudo apt update
sudo apt install nginx

# Copy blue-green configuration
sudo cp deployment/blue-green/nginx-blue-green.conf /etc/nginx/conf.d/blue-green.conf

# Remove default configuration
sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 5. SSL/TLS Setup (Optional)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🤖 GitHub Actions Setup

### Required Secrets

Configure these secrets in your GitHub repository:

```bash
DEPLOY_HOST=your-server-ip-or-domain
DEPLOY_USER=your-ssh-username
SSH_PRIVATE_KEY=your-ssh-private-key
GITHUB_TOKEN=automatically-provided
```

### SSH Key Setup

```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -C "github-actions@your-domain.com"

# Add public key to server
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@your-server

# Add private key to GitHub Secrets
cat ~/.ssh/id_ed25519  # Copy this to SSH_PRIVATE_KEY secret
```

## 📊 Monitoring and Logging

### Log Files
- **Nginx Access**: `/var/log/nginx/blue_green_access.log`
- **Nginx Error**: `/var/log/nginx/blue_green_error.log`
- **Slot Switches**: `/var/log/blue-green-switches.log`
- **Rollbacks**: `/var/log/blue-green-rollbacks.log`

### Container Logs
```bash
# View application logs
docker logs api-blue
docker logs api-green
docker logs frontend-blue
docker logs frontend-green

# Follow logs in real-time
docker logs -f api-blue
```

### Health Monitoring
```bash
# Continuous health monitoring
watch -n 5 'curl -s localhost/api/v1/health | jq'

# Check both slots
curl -s localhost:8001/api/v1/health | jq '.slot'
curl -s localhost:8002/api/v1/health | jq '.slot'
```

## 🚨 Troubleshooting

### Common Issues

**1. Health Check Failures**
```bash
# Check container status
docker ps

# Check container logs
docker logs api-blue
docker logs api-green

# Test health endpoint directly
curl -v localhost:3001/api/v1/health
curl -v localhost:3002/api/v1/health
```

**2. Nginx Configuration Issues**
```bash
# Test nginx configuration
sudo nginx -t

# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Reload nginx
sudo nginx -s reload
```

**3. Database Connection Issues**
```bash
# Check MongoDB
docker logs sms-mongodb-shared

# Test MongoDB connection
docker exec -it sms-mongodb-shared mongosh -u admin -p

# Check Redis
docker logs sms-redis-shared
redis-cli ping
```

**4. Port Conflicts**
```bash
# Check what's using ports
sudo netstat -tulpn | grep :3001
sudo netstat -tulpn | grep :3002

# Kill processes using ports
sudo fuser -k 3001/tcp
sudo fuser -k 3002/tcp
```

### Emergency Procedures

**1. Immediate Rollback**
```bash
./deployment/blue-green/rollback.sh --force
```

**2. Manual Traffic Switch**
```bash
# Edit nginx config directly
sudo nano /etc/nginx/conf.d/blue-green.conf
# Change port numbers manually
sudo nginx -s reload
```

**3. Stop All Services**
```bash
docker-compose -f deployment/blue-green/docker-compose.blue.yml down
docker-compose -f deployment/blue-green/docker-compose.green.yml down
```

## 📈 Performance Considerations

### Resource Allocation
- **Backend**: 2 CPU cores, 2GB RAM per slot
- **Frontend**: 1 CPU core, 512MB RAM per slot
- **MongoDB**: Shared, 4 CPU cores, 4GB RAM
- **Redis**: Shared, 1 CPU core, 1GB RAM

### Scaling
- Horizontal scaling: Add more server instances
- Vertical scaling: Increase container resources
- Database scaling: MongoDB replica sets, Redis clustering

## 🔒 Security Considerations

### Network Security
- Use internal networks for service communication
- Expose only necessary ports
- Implement rate limiting
- Use SSL/TLS for external traffic

### Container Security
- Use non-root users in containers
- Scan images for vulnerabilities
- Keep base images updated
- Use secrets management

### Access Control
- Restrict SSH access
- Use key-based authentication
- Implement proper firewall rules
- Monitor access logs

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Load Balancing](https://nginx.org/en/docs/http/load_balancing.html)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Blue-Green Deployment Best Practices](https://martinfowler.com/bliki/BlueGreenDeployment.html)