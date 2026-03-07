# Production Deployment Checklist

## Pre-Deployment

### Infrastructure
- [ ] Server provisioned with minimum requirements (4 CPU, 8GB RAM, 50GB SSD)
- [ ] Ubuntu 22.04 LTS installed and updated
- [ ] Docker and Docker Compose installed
- [ ] Firewall configured (ports 22, 80, 443 open)
- [ ] Domain name registered and DNS configured
- [ ] SSL certificate obtained (Let's Encrypt or custom)

### Environment Configuration
- [ ] `.env.production` created from template
- [ ] `apps/backend/.env.production` created from template
- [ ] Strong passwords generated for MongoDB and Redis
- [ ] JWT secrets generated (64+ characters)
- [ ] Encryption key generated (64 hex characters)
- [ ] All API keys configured (Stripe, OpenAI, AWS, etc.)
- [ ] Frontend URL configured correctly
- [ ] API URL configured correctly
- [ ] Environment files have restricted permissions (chmod 600)

### Security
- [ ] MongoDB authentication enabled
- [ ] Redis password set
- [ ] JWT secrets are strong and unique
- [ ] Encryption key is strong and unique
- [ ] HTTPS enforced (FORCE_HTTPS=true)
- [ ] Secure cookies enabled (COOKIE_SECURE=true)
- [ ] CORS configured with production domain
- [ ] Rate limiting configured
- [ ] Security headers configured
- [ ] No secrets in version control
- [ ] No default passwords in use

### External Services
- [ ] MongoDB Atlas or production database configured
- [ ] Redis Cloud or production cache configured
- [ ] AWS S3 bucket created and configured
- [ ] Stripe account in production mode
- [ ] OpenAI API key for production
- [ ] Social media API credentials configured
- [ ] Email service configured (SMTP)
- [ ] Sentry or error tracking configured (optional)

---

## Deployment

### Build & Deploy
- [ ] Code pulled from main branch
- [ ] Docker images built successfully
- [ ] Database services started (MongoDB, Redis)
- [ ] Database connections verified
- [ ] Application services started (backend, worker, frontend)
- [ ] All containers running and healthy
- [ ] Health checks passing

### Database Setup
- [ ] Database indexes created automatically
- [ ] Database indexes verified
- [ ] Initial data seeded (if needed)
- [ ] Database backup tested

### SSL/TLS Configuration
- [ ] SSL certificates installed
- [ ] Nginx reverse proxy configured
- [ ] HTTPS working for frontend
- [ ] HTTPS working for API
- [ ] HTTP to HTTPS redirect working
- [ ] SSL certificate auto-renewal configured

### Application Verification
- [ ] Frontend loads correctly
- [ ] API health endpoint responding
- [ ] User registration working
- [ ] User login working
- [ ] JWT token refresh working
- [ ] Workspace creation working
- [ ] Post creation working
- [ ] Post scheduling working
- [ ] Worker processing jobs
- [ ] AI generation working
- [ ] Billing/Stripe integration working
- [ ] Analytics working

---

## Post-Deployment

### Monitoring & Logging
- [ ] Application logs accessible
- [ ] Error logs being written
- [ ] Log rotation configured
- [ ] Monitoring dashboard set up (optional)
- [ ] Error tracking active (Sentry, etc.)
- [ ] Uptime monitoring configured
- [ ] Alert thresholds configured

### Backup & Recovery
- [ ] Backup scripts tested
- [ ] MongoDB backup working
- [ ] Redis backup working
- [ ] Automated backup cron jobs configured
- [ ] Backup retention policy set (30 days)
- [ ] Offsite backup configured (S3, etc.)
- [ ] Restore procedure tested
- [ ] Disaster recovery plan documented

### Performance
- [ ] API response times acceptable (<200ms p95)
- [ ] Frontend load time acceptable (<3s)
- [ ] Database queries optimized
- [ ] Redis caching working
- [ ] CDN configured for static assets (optional)
- [ ] Gzip compression enabled
- [ ] Resource limits configured

### Security Audit
- [ ] No secrets in logs
- [ ] No stack traces in production errors
- [ ] Rate limiting working
- [ ] CORS properly configured
- [ ] Security headers present
- [ ] Input validation working
- [ ] XSS protection working
- [ ] SQL/NoSQL injection protection working
- [ ] CSRF protection working
- [ ] Token expiry working
- [ ] Session management secure

### Documentation
- [ ] Deployment guide reviewed
- [ ] Environment variables documented
- [ ] API documentation available
- [ ] User guide available
- [ ] Runbooks created for common issues
- [ ] Team trained on deployment process
- [ ] Emergency contacts documented

---

## Ongoing Maintenance

### Daily
- [ ] Monitor application logs for errors
- [ ] Check disk space
- [ ] Verify backups completed successfully
- [ ] Monitor API response times
- [ ] Check error rates

### Weekly
- [ ] Review application metrics
- [ ] Check for security updates
- [ ] Test backup restoration
- [ ] Review and respond to user feedback
- [ ] Check queue processing stats

### Monthly
- [ ] Update dependencies
- [ ] Review and optimize database indexes
- [ ] Clean up old logs and backups
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Capacity planning review

### Quarterly
- [ ] Disaster recovery drill
- [ ] Security penetration testing
- [ ] Load testing
- [ ] Review and update documentation
- [ ] Team training on new features

---

## Scaling Checklist

### When to Scale
- [ ] CPU usage consistently >70%
- [ ] Memory usage consistently >80%
- [ ] API response times >500ms p95
- [ ] Queue depth consistently >1000 jobs
- [ ] Database connections >80% of pool

### Horizontal Scaling
- [ ] Scale worker instances
- [ ] Scale backend API instances
- [ ] Configure load balancer
- [ ] Update DNS for load balancing
- [ ] Test failover

### Vertical Scaling
- [ ] Increase server resources
- [ ] Update Docker resource limits
- [ ] Increase database connection pool
- [ ] Increase Redis memory limit
- [ ] Restart services with new limits

### Database Scaling
- [ ] Set up MongoDB replica set
- [ ] Configure Redis Sentinel/Cluster
- [ ] Implement read replicas
- [ ] Optimize slow queries
- [ ] Archive old data

---

## Emergency Procedures

### System Down
1. Check container status: `docker compose -f docker-compose.production.yml ps`
2. Check logs: `docker compose -f docker-compose.production.yml logs`
3. Restart services: `docker compose -f docker-compose.production.yml restart`
4. If needed, full restart: `docker compose -f docker-compose.production.yml down && docker compose -f docker-compose.production.yml up -d`

### Database Corruption
1. Stop application services
2. Restore from latest backup
3. Verify data integrity
4. Restart application services
5. Monitor for issues

### Security Breach
1. Immediately rotate all secrets (JWT, encryption keys, passwords)
2. Review logs for suspicious activity
3. Restore from clean backup if needed
4. Update all user passwords
5. Notify affected users
6. Conduct security audit

### High Load
1. Scale worker instances
2. Enable Redis caching
3. Optimize slow queries
4. Increase rate limits temporarily
5. Add more server resources

---

## Success Criteria

The deployment is successful when:

- [ ] All services are running and healthy
- [ ] All health checks passing
- [ ] Users can register and login
- [ ] Users can create and schedule posts
- [ ] Worker is processing jobs
- [ ] Backups are running automatically
- [ ] Monitoring is active
- [ ] SSL/TLS is working
- [ ] No critical errors in logs
- [ ] Performance meets targets
- [ ] Security audit passed
- [ ] Team is trained
- [ ] Documentation is complete

---

## Sign-Off

### Deployment Team
- [ ] Developer: _________________ Date: _______
- [ ] DevOps: _________________ Date: _______
- [ ] Security: _________________ Date: _______
- [ ] QA: _________________ Date: _______

### Approval
- [ ] Technical Lead: _________________ Date: _______
- [ ] Product Manager: _________________ Date: _______

---

## Notes

Use this space to document any deployment-specific notes, issues encountered, or deviations from the standard process:

```
[Add notes here]
```

---

## Version History

| Version | Date | Deployed By | Notes |
|---------|------|-------------|-------|
| 1.0.0   |      |             | Initial production deployment |
|         |      |             |                               |
|         |      |             |                               |
