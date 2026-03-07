# Authentication System Test Guide

## Quick Start

```bash
# Start services
docker compose up

# Wait for services to be ready
# Backend: http://localhost:5000
# MongoDB: localhost:27017
# Redis: localhost:6379
```

## Test Scenarios

### 1. Register New User

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Expected Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "_id": "...",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "member",
    "isEmailVerified": false,
    "provider": "local"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Login

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

**Expected Response (200):**
```json
{
  "message": "Login successful",
  "user": { ... },
  "accessToken": "..."
}
```

### 3. Get Current User (Protected Route)

```bash
# Replace <TOKEN> with accessToken from login/register
curl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected Response (200):**
```json
{
  "user": {
    "_id": "...",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "member"
  }
}
```

### 4. Refresh Token

```bash
# Save refreshToken from login response
curl -X POST http://localhost:5000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<REFRESH_TOKEN>"
  }'
```

**Expected Response (200):**
```json
{
  "message": "Token refreshed successfully",
  "accessToken": "..."
}
```

### 5. Change Password

```bash
curl -X POST http://localhost:5000/api/v1/auth/change-password \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "SecurePass123",
    "newPassword": "NewSecurePass456"
  }'
```

**Expected Response (200):**
```json
{
  "message": "Password changed successfully. Please login again."
}
```

### 6. Logout

```bash
curl -X POST http://localhost:5000/api/v1/auth/logout \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<REFRESH_TOKEN>"
  }'
```

**Expected Response (200):**
```json
{
  "message": "Logout successful"
}
```

### 7. Logout All Devices

```bash
curl -X POST http://localhost:5000/api/v1/auth/logout-all \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected Response (200):**
```json
{
  "message": "Logged out from all devices successfully"
}
```

## Error Scenarios

### 1. Invalid Email Format

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Expected Response (400):**
```json
{
  "error": "Validation Error",
  "message": "Validation failed",
  "details": {
    "errors": [
      {
        "field": "body.email",
        "message": "Invalid email address"
      }
    ]
  }
}
```

### 2. Weak Password

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "weak",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Expected Response (400):**
```json
{
  "error": "Validation Error",
  "message": "Validation failed",
  "details": {
    "errors": [
      {
        "field": "body.password",
        "message": "Password must be at least 8 characters"
      }
    ]
  }
}
```

### 3. Duplicate Email

```bash
# Register same email twice
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Expected Response (409):**
```json
{
  "error": "Conflict Error",
  "message": "User with this email already exists"
}
```

### 4. Invalid Credentials

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "WrongPassword"
  }'
```

**Expected Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "Invalid email or password"
}
```

### 5. Expired Token

```bash
# Use an expired token
curl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer <EXPIRED_TOKEN>"
```

**Expected Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "Access token has expired"
}
```

### 6. Rate Limit Exceeded

```bash
# Try to login 6 times quickly
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo ""
done
```

**Expected Response on 6th attempt (429):**
```json
{
  "error": "Too Many Requests",
  "message": "Too many authentication attempts. Please try again in 15 minutes.",
  "retryAfter": 900
}
```

## Security Tests

### 1. Password Not Returned

```bash
# Register or login and check response
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "security@example.com",
    "password": "SecurePass123",
    "firstName": "Security",
    "lastName": "Test"
  }'
```

**Verify:** Response should NOT contain `password` field

### 2. Refresh Token Reuse Detection

```bash
# 1. Login and save refresh token
# 2. Use refresh token to get new tokens
# 3. Try to use the OLD refresh token again
curl -X POST http://localhost:5000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<OLD_REFRESH_TOKEN>"
  }'
```

**Expected:** 401 Unauthorized - "Invalid refresh token. Please login again."

### 3. Soft Delete Check

```bash
# After user is soft-deleted, try to login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "deleted@example.com",
    "password": "SecurePass123"
  }'
```

**Expected:** 401 Unauthorized

## MongoDB Verification

```bash
# Connect to MongoDB
docker compose exec mongodb mongosh -u admin -p password123 social-media-scheduler

# Check users
db.users.find().pretty()

# Verify password is hashed
db.users.findOne({ email: "john@example.com" })
# Should see: password: "$2b$12$..."

# Check refresh tokens (should be array)
db.users.findOne({ email: "john@example.com" }, { refreshTokens: 1 })
```

## Redis Verification

```bash
# Connect to Redis
docker compose exec redis redis-cli

# Check for any cached data
KEYS *

# Monitor Redis commands
MONITOR
```

## Postman Collection

Import this collection for easier testing:

```json
{
  "info": {
    "name": "Social Media Scheduler - Auth",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Register",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"{{email}}\",\n  \"password\": \"{{password}}\",\n  \"firstName\": \"John\",\n  \"lastName\": \"Doe\"\n}"
        },
        "url": "{{baseUrl}}/api/v1/auth/register"
      }
    },
    {
      "name": "Login",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"{{email}}\",\n  \"password\": \"{{password}}\"\n}"
        },
        "url": "{{baseUrl}}/api/v1/auth/login"
      }
    },
    {
      "name": "Get Current User",
      "request": {
        "method": "GET",
        "header": [{"key": "Authorization", "value": "Bearer {{accessToken}}"}],
        "url": "{{baseUrl}}/api/v1/auth/me"
      }
    }
  ],
  "variable": [
    {"key": "baseUrl", "value": "http://localhost:5000"},
    {"key": "email", "value": "test@example.com"},
    {"key": "password", "value": "SecurePass123"},
    {"key": "accessToken", "value": ""}
  ]
}
```

## Troubleshooting

### Issue: Connection Refused

```bash
# Check if services are running
docker compose ps

# Check backend logs
docker compose logs backend

# Restart services
docker compose restart backend
```

### Issue: MongoDB Connection Error

```bash
# Check MongoDB health
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check MongoDB logs
docker compose logs mongodb
```

### Issue: Token Verification Failed

```bash
# Check JWT secrets in .env
cat apps/backend/.env | grep JWT

# Ensure secrets are at least 32 characters
```

### Issue: Rate Limit Not Working

```bash
# Check if Redis is running
docker compose exec redis redis-cli ping

# Should return: PONG
```

## Success Criteria

- ✅ User can register with valid data
- ✅ User cannot register with invalid email
- ✅ User cannot register with weak password
- ✅ User cannot register with duplicate email
- ✅ User can login with correct credentials
- ✅ User cannot login with wrong password
- ✅ User can access protected routes with valid token
- ✅ User cannot access protected routes without token
- ✅ User can refresh access token
- ✅ User cannot reuse old refresh token
- ✅ User can change password
- ✅ User can logout
- ✅ User can logout from all devices
- ✅ Rate limiting works on auth endpoints
- ✅ Password is never returned in responses
- ✅ Password is hashed in database
- ✅ Tokens expire correctly
- ✅ Soft-deleted users cannot login

---

**All tests passing = Authentication system is production-ready!** ✅
