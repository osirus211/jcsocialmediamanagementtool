# Onboarding Wizard - External Dependencies Mapping

## Overview
This document provides a comprehensive mapping of all external dependencies for the Onboarding Wizard module, including API calls, third-party integrations, database interactions, environment variables, and potential failure points.

## API Endpoints & Backend Dependencies

### Core Onboarding API Endpoints
**Base Path**: `/api/v1/onboarding`

#### 1. GET /api/v1/onboarding/progress
- **Purpose**: Retrieve user's current onboarding progress
- **Authentication**: Required (`requireAuth` middleware)
- **Dependencies**: 
  - User model database query
  - JWT token verification
- **Response**: Current step, completion status, completed steps array
- **Failure Points**: Database connection, invalid JWT token

#### 2. PUT /api/v1/onboarding/step
- **Purpose**: Update user's current onboarding step
- **Authentication**: Required (`requireAuth` middleware)
- **Request Body**: `{ step: number }` (0-5)
- **Dependencies**:
  - User model database update
  - Step validation logic
- **Business Rules**: Only forward progression allowed (unless completed)
- **Failure Points**: Invalid step number, database write failure

#### 3. POST /api/v1/onboarding/complete
- **Purpose**: Mark onboarding as completed
- **Authentication**: Required (`requireAuth` middleware)
- **Dependencies**:
  - User model update (`onboardingCompleted: true`, `onboardingStep: 5`)
  - Database transaction
- **Side Effects**: User can access full application
- **Failure Points**: Database write failure

#### 4. POST /api/v1/onboarding/skip
- **Purpose**: Skip entire onboarding process
- **Authentication**: Required (`requireAuth` middleware)
- **Dependencies**: Same as complete endpoint
- **Business Logic**: Sets completion without step progression
- **Failure Points**: Database write failure

#### 5. GET /api/v1/onboarding/needs-onboarding
- **Purpose**: Check if user requires onboarding
- **Authentication**: Required (`requireAuth` middleware)
- **Dependencies**: User model query for `onboardingCompleted` field
- **Usage**: Route protection logic
- **Failure Points**: Database connection, user not found

## Authentication System Integration

### JWT Token Dependencies
- **Service**: `AuthTokenService.verifyAccessToken()`
- **Purpose**: Validate user authentication for all onboarding endpoints
- **Dependencies**:
  - JWT secret from environment variables
  - User model validation
  - Token expiry checking
- **Failure Points**: 
  - Invalid/expired tokens
  - User account deleted/disabled
  - JWT secret misconfiguration

### User Model Dependencies
- **Database**: MongoDB via Mongoose ODM
- **Critical Fields**:
  - `onboardingCompleted: boolean` (default: false)
  - `onboardingStep: number` (default: 0, range: 0-5)
  - `email: string` (for user identification)
  - `softDeletedAt: Date` (soft delete check)
- **Indexes**: Performance optimization on user queries
- **Failure Points**: Database connection, schema validation errors

## External System Integrations

### 1. OAuth Connection System (`/connect-v2`)
**Integration Point**: Step 1 - Connect Accounts

#### Frontend Integration
- **Navigation**: `/connect-v2?platform={platformId}&return=/onboarding`
- **Return Flow**: OAuth completion should return to onboarding
- **Supported Platforms**: Twitter, Facebook, Instagram, LinkedIn, YouTube, TikTok
- **State Management**: Connection status updates in onboarding store

#### Backend Dependencies
- **OAuth Routes**: Platform-specific OAuth endpoints
- **Services**: Platform OAuth services (TwitterOAuth, FacebookOAuth, etc.)
- **Environment Variables**:
  - `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`
  - `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
  - `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`
  - `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
  - `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`
  - `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET`
- **Redirect URLs**: Platform-specific callback URLs
- **Failure Points**:
  - OAuth provider API downtime
  - Invalid credentials/configuration
  - Network connectivity issues
  - Callback URL mismatches

### 2. Post Composer Integration (`/posts/create`)
**Integration Point**: Step 2 - Create Post

#### Frontend Integration
- **Navigation**: `/posts/create?onboarding=true`
- **Context Flag**: `onboarding=true` indicates return flow
- **Return Mechanism**: Post creation should update onboarding state
- **State Tracking**: `firstPostCreated` boolean in onboarding data

#### Backend Dependencies
- **Post Creation API**: Full post composer backend
- **Media Upload**: File upload and processing services
- **Publishing Queue**: Post scheduling and publishing system
- **Failure Points**:
  - Post creation API failures
  - Media upload service downtime
  - Publishing queue issues
  - Return flow navigation broken

### 3. Team Invitation System (Step 3)
**Integration Point**: Step 3 - Invite Team

#### Current Status
- **Implementation**: NOT IMPLEMENTED (TODO comment in code)
- **Planned API**: Team invitation email service
- **Email Dependencies**: Email service integration required

#### Required Dependencies (When Implemented)
- **Email Service**: Send invitation emails
- **Team Management API**: User role and permission system
- **Email Templates**: Invitation email formatting
- **Environment Variables**: Email service configuration
- **Failure Points**:
  - Email service downtime
  - Invalid email addresses
  - SMTP configuration issues
  - Team management API failures

## Database Dependencies

### Primary Database: MongoDB
- **Connection**: Via Mongoose ODM
- **Environment Variable**: `MONGODB_URI`
- **Collections Used**:
  - `users` - Primary user data and onboarding state
  - `socialaccounts` - Connected social media accounts (OAuth integration)
  - `posts` - Created posts (composer integration)

### User Collection Schema
```javascript
{
  onboardingCompleted: Boolean (default: false),
  onboardingStep: Number (default: 0, min: 0, max: 5),
  email: String (unique, required),
  softDeletedAt: Date (soft delete flag),
  // ... other user fields
}
```

### Database Operations
- **Read Operations**: User progress queries, authentication checks
- **Write Operations**: Step updates, completion status changes
- **Transactions**: Atomic updates for state changes
- **Indexes**: Performance optimization for user lookups

### Failure Points
- **Connection Issues**: Network connectivity, authentication
- **Performance**: Slow queries, index optimization
- **Data Integrity**: Concurrent updates, validation errors
- **Storage**: Disk space, memory limitations

## Environment Variables Requirements

### Core Application Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/social-media-scheduler

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:5173

# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Node Environment
NODE_ENV=development|production
LOG_LEVEL=info|debug|error
```

### OAuth Provider Credentials
```bash
# Twitter/X
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
TWITTER_REDIRECT_URI=http://localhost:3001/api/v1/oauth/twitter/callback

# Facebook
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_REDIRECT_URI=http://localhost:3001/api/v1/oauth/facebook/callback

# Instagram
INSTAGRAM_CLIENT_ID=your-instagram-client-id
INSTAGRAM_CLIENT_SECRET=your-instagram-client-secret
INSTAGRAM_REDIRECT_URI=http://localhost:3001/api/v1/oauth/instagram/callback

# LinkedIn
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:3001/api/v1/oauth/linkedin/callback

# YouTube
YOUTUBE_CLIENT_ID=your-youtube-client-id
YOUTUBE_CLIENT_SECRET=your-youtube-client-secret
YOUTUBE_REDIRECT_URI=http://localhost:3001/api/v1/oauth/youtube/callback

# TikTok
TIKTOK_CLIENT_ID=your-tiktok-client-id
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret
TIKTOK_REDIRECT_URI=http://localhost:3001/api/v1/oauth/tiktok/callback
```

### Email Service Configuration (Future)
```bash
# Email Service (when team invitations implemented)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@yourdomain.com
```

## Third-Party Service Dependencies

### 1. Social Media Platform APIs
**Purpose**: OAuth authentication and account connection

#### Twitter/X API
- **Endpoints**: OAuth 2.0 flow endpoints
- **Rate Limits**: OAuth requests per hour
- **Failure Modes**: API downtime, rate limiting, policy changes
- **Monitoring**: Connection success/failure rates

#### Facebook Graph API
- **Endpoints**: OAuth and basic profile access
- **Permissions**: Required scopes for account connection
- **Failure Modes**: API changes, permission revocation
- **Monitoring**: OAuth callback success rates

#### Instagram Basic Display API
- **Endpoints**: OAuth flow for personal accounts
- **Limitations**: Basic Display vs Business API differences
- **Failure Modes**: API deprecation, scope changes
- **Monitoring**: Connection establishment rates

#### LinkedIn API
- **Endpoints**: OAuth 2.0 for professional profiles
- **Rate Limits**: API call quotas
- **Failure Modes**: API versioning, permission changes
- **Monitoring**: Authentication success rates

#### YouTube Data API
- **Endpoints**: OAuth for channel access
- **Quotas**: Daily API usage limits
- **Failure Modes**: Quota exhaustion, API changes
- **Monitoring**: Connection health checks

#### TikTok for Developers
- **Endpoints**: OAuth for creator accounts
- **Requirements**: Developer account approval
- **Failure Modes**: API access revocation, policy updates
- **Monitoring**: OAuth flow completion rates

### 2. Email Service Provider (Future Implementation)
**Purpose**: Team invitation emails

#### SMTP Service
- **Providers**: SendGrid, Mailgun, AWS SES, etc.
- **Dependencies**: SMTP configuration, authentication
- **Failure Modes**: Service downtime, delivery failures
- **Monitoring**: Email delivery rates, bounce rates

## Frontend Dependencies

### State Management
- **Zustand Store**: `useOnboardingStore`
- **Persistence**: localStorage via Zustand middleware
- **State Shape**:
  ```typescript
  {
    progress: OnboardingProgress | null,
    isLoading: boolean,
    currentStepData: OnboardingStepData
  }
  ```

### HTTP Client
- **Service**: `apiClient` (Axios-based)
- **Base URL**: Backend API endpoint
- **Authentication**: Bearer token in headers
- **Error Handling**: HTTP status code processing
- **Failure Points**: Network connectivity, CORS issues

### Router Integration
- **React Router**: Navigation between steps and external systems
- **Protected Routes**: Authentication-based access control
- **Route Guards**: Onboarding completion checks
- **Navigation Patterns**: 
  - Forward/backward step navigation
  - External system integration (OAuth, composer)
  - Completion redirects

### Browser Dependencies
- **localStorage**: State persistence across sessions
- **sessionStorage**: Temporary state management
- **Cookies**: Authentication token storage
- **Network APIs**: Fetch/XMLHttpRequest for API calls
- **Failure Points**: Storage quotas, network restrictions

## Integration Failure Points & Mitigation

### 1. OAuth Integration Failures
**Symptoms**:
- Users cannot connect social accounts
- OAuth callbacks fail to return to onboarding
- Connection status not updated correctly

**Root Causes**:
- OAuth provider API downtime
- Misconfigured redirect URLs
- Invalid client credentials
- Network connectivity issues

**Mitigation Strategies**:
- Retry mechanisms for OAuth requests
- Fallback messaging for service unavailability
- Connection status validation
- Error logging and monitoring

### 2. Database Connection Issues
**Symptoms**:
- Progress not saving between steps
- User authentication failures
- Step advancement not persisting

**Root Causes**:
- MongoDB connection timeouts
- Database server downtime
- Network connectivity issues
- Authentication failures

**Mitigation Strategies**:
- Connection pooling and retry logic
- Database health monitoring
- Graceful degradation for read-only mode
- Error handling and user feedback

### 3. API Communication Failures
**Symptoms**:
- Step advancement not working
- Loading states stuck indefinitely
- Error messages not displayed

**Root Causes**:
- Backend service downtime
- Network connectivity issues
- CORS configuration problems
- Authentication token expiry

**Mitigation Strategies**:
- Request timeout handling
- Retry logic for failed requests
- Offline state detection
- Token refresh mechanisms

### 4. State Management Issues
**Symptoms**:
- Progress lost on page refresh
- Step data not persisting
- Navigation state inconsistencies

**Root Causes**:
- localStorage quota exceeded
- Browser storage restrictions
- State synchronization failures
- Concurrent tab issues

**Mitigation Strategies**:
- Storage quota monitoring
- State validation and recovery
- Conflict resolution for concurrent access
- Fallback to server-side state

## Security Considerations

### Authentication Security
- **JWT Token Validation**: All endpoints require valid authentication
- **Token Storage**: Secure storage in httpOnly cookies (recommended)
- **Session Management**: Token expiry and refresh handling
- **User Verification**: Active user account validation

### Data Protection
- **Input Validation**: All user inputs validated on frontend and backend
- **SQL Injection Prevention**: Mongoose ODM provides protection
- **XSS Protection**: Input sanitization and output encoding
- **CSRF Protection**: Required for state-changing operations

### OAuth Security
- **State Parameter**: CSRF protection for OAuth flows
- **Redirect URL Validation**: Prevent open redirect vulnerabilities
- **Scope Limitation**: Minimal required permissions
- **Token Security**: Secure storage and transmission

### Environment Security
- **Secret Management**: Environment variables for sensitive data
- **Configuration Validation**: Required environment variables checked
- **Access Control**: Database and service access restrictions
- **Logging Security**: Sensitive data excluded from logs

## Monitoring & Observability

### Key Metrics
- **Onboarding Completion Rate**: Percentage of users completing full flow
- **Step Drop-off Rates**: Where users abandon the process
- **OAuth Connection Success**: Platform-specific connection rates
- **API Response Times**: Performance monitoring for all endpoints
- **Error Rates**: Failed requests and system errors

### Health Checks
- **Database Connectivity**: MongoDB connection status
- **OAuth Provider Status**: Platform API availability
- **Email Service Health**: SMTP service connectivity (future)
- **Frontend Asset Delivery**: CDN and static file availability

### Alerting
- **High Error Rates**: API failures above threshold
- **Database Issues**: Connection or performance problems
- **OAuth Failures**: Platform-specific connection issues
- **Completion Rate Drops**: Significant decreases in success rates

## Performance Considerations

### Database Optimization
- **Indexes**: Optimized queries for user lookups
- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Minimal data retrieval
- **Caching**: Redis for frequently accessed data

### API Performance
- **Response Times**: Target <200ms for step updates
- **Concurrent Users**: Support for multiple simultaneous onboardings
- **Rate Limiting**: Protection against abuse
- **Caching**: Static data and configuration caching

### Frontend Performance
- **Bundle Size**: Optimized JavaScript delivery
- **Lazy Loading**: Step components loaded on demand
- **State Efficiency**: Minimal re-renders and updates
- **Network Optimization**: Request batching and caching

## Summary

The Onboarding Wizard module has extensive external dependencies across multiple system layers:

**Critical Dependencies**:
- MongoDB database for user state persistence
- JWT authentication system for security
- OAuth providers for social media integration
- Post composer system for content creation
- Frontend state management and routing

**Key Integration Points**:
- 5 core API endpoints for progress management
- 6+ OAuth providers for social account connection
- Post creation system integration
- Team invitation system (future implementation)

**Major Failure Points**:
- Database connectivity and performance
- OAuth provider API availability
- Network connectivity and CORS issues
- State synchronization between frontend and backend
- Authentication token management

**Environment Requirements**:
- 20+ environment variables for configuration
- OAuth credentials for each social platform
- Database connection strings
- Frontend/backend URL configuration

This comprehensive dependency mapping provides the foundation for implementing robust error handling, monitoring, and testing strategies for the onboarding wizard module.