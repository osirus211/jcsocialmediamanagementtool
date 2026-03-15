# Onboarding Wizard Module - Complete Inventory

## Overview
This document provides a comprehensive mapping of all files belonging to the Onboarding Wizard module, their relationships, dependencies, and structure.

## Module Structure

### Frontend Components

#### Core Components
- **`apps/frontend/src/components/onboarding/OnboardingWizard.tsx`**
  - Main orchestrator component for the multi-step onboarding flow
  - Dependencies: useOnboardingStore, useAuthStore, ONBOARDING_STEPS, all step components
  - Handles navigation, state management, and step rendering
  - Manages loading states and error handling

- **`apps/frontend/src/components/onboarding/OnboardingProgress.tsx`**
  - Progress indicator component showing current step and completion status
  - Dependencies: None (pure UI component)
  - Provides clickable step navigation
  - Shows visual progress through the 5-step flow

- **`apps/frontend/src/components/onboarding/FirstPostOnboarding.tsx`**
  - Separate onboarding component for first post creation guidance
  - Dependencies: useNavigate (React Router)
  - Used outside the main wizard flow
  - Provides contextual help for new users

#### Step Components (apps/frontend/src/components/onboarding/steps/)
- **`WelcomeStep.tsx`** (Step 0)
  - Personalization step: role, team size, primary goal selection
  - Dependencies: useOnboardingStore, useAuthStore, ROLE_OPTIONS, TEAM_SIZE_OPTIONS, GOAL_OPTIONS
  - Validates all fields before allowing progression

- **`ConnectAccountsStep.tsx`** (Step 1)
  - Social media account connection step
  - Dependencies: useOnboardingStore, useNavigate
  - Integrates with OAuth connection flow via `/connect-v2`
  - Allows skipping if no accounts connected

- **`CreatePostStep.tsx`** (Step 2)
  - First post creation step
  - Dependencies: useOnboardingStore, useNavigate
  - Redirects to full composer (`/posts/create?onboarding=true`)
  - Tracks completion status

- **`InviteTeamStep.tsx`** (Step 3)
  - Team member invitation step
  - Dependencies: useOnboardingStore
  - Email validation and role assignment
  - Allows skipping for solo users

- **`CompleteStep.tsx`** (Step 4)
  - Final completion step with confetti and next actions
  - Dependencies: useOnboardingStore, useAuthStore, useNavigate
  - Shows setup summary and quick action buttons
  - Provides navigation to key features

### Frontend State Management

#### Store
- **`apps/frontend/src/store/onboarding.store.ts`**
  - Zustand store managing onboarding state
  - Dependencies: apiClient, OnboardingStore interface, logger
  - Persists currentStepData to localStorage
  - API integration for progress tracking
  - Actions: fetchProgress, updateStep, completeOnboarding, skipOnboarding, updateStepData, clearOnboarding

#### Types
- **`apps/frontend/src/types/onboarding.types.ts`**
  - TypeScript interfaces and constants for onboarding
  - Dependencies: None
  - Defines: OnboardingProgress, OnboardingStepData, OnboardingState, OnboardingActions, OnboardingStore
  - Constants: ONBOARDING_STEPS, ROLE_OPTIONS, TEAM_SIZE_OPTIONS, GOAL_OPTIONS

- **`apps/frontend/src/types/auth.types.ts`** (Partial)
  - Contains onboarding-related user fields
  - Fields: onboardingCompleted: boolean, onboardingStep: number

### Frontend Routing & Pages

#### Page Component
- **`apps/frontend/src/pages/OnboardingPage.tsx`**
  - Full-page wrapper for OnboardingWizard
  - Dependencies: useAuthStore, useOnboardingStore, OnboardingWizard
  - Handles authentication checks and redirects
  - Prevents access if onboarding already completed

#### Router Configuration
- **`apps/frontend/src/app/router.tsx`** (Partial)
  - Route definition: `/onboarding` → OnboardingPage
  - Protected route requiring authentication
  - Lazy-loaded component

#### Route Protection
- **`apps/frontend/src/components/auth/ProtectedRoute.tsx`** (Partial)
  - Redirects unauthenticated users to onboarding if not completed
  - Logic: `if (user && !user.onboardingCompleted && location.pathname !== '/onboarding')`

### Backend API Layer

#### Routes
- **`apps/backend/src/routes/v1/onboarding.routes.ts`**
  - Express router defining onboarding API endpoints
  - Dependencies: requireAuth middleware, OnboardingController
  - Endpoints:
    - `GET /api/v1/onboarding/progress` - Get user's progress
    - `PUT /api/v1/onboarding/step` - Update current step
    - `POST /api/v1/onboarding/complete` - Mark as completed
    - `POST /api/v1/onboarding/skip` - Skip onboarding
    - `GET /api/v1/onboarding/needs-onboarding` - Check if needed

#### Controllers
- **`apps/backend/src/controllers/OnboardingController.ts`**
  - Express controllers handling HTTP requests
  - Dependencies: OnboardingService, BadRequestError
  - Methods: getProgress, updateStep, completeOnboarding, skipOnboarding, needsOnboarding
  - Validates request data and delegates to service layer

#### Services
- **`apps/backend/src/services/OnboardingService.ts`**
  - Business logic for onboarding operations
  - Dependencies: User model, error classes, logger
  - Methods: getProgress, updateStep, completeOnboarding, skipOnboarding, resetOnboarding, needsOnboarding
  - Validates step progression rules and updates database

### Backend Data Layer

#### Models
- **`apps/backend/src/models/User.ts`** (Partial)
  - MongoDB schema with onboarding fields
  - Fields:
    - `onboardingCompleted: boolean` (default: false)
    - `onboardingStep: number` (default: 0, min: 0, max: 5)
  - Validation: Step must be between 0-5
  - Indexes: Performance optimization for queries

### Backend Integration

#### Route Registration
- **`apps/backend/src/routes/v1/index.js`** (Compiled)
  - Registers onboarding routes: `router.use('/onboarding', onboardingRoutes)`
  - API base path: `/api/v1/onboarding`

#### Email Integration
- **`apps/backend/src/services/EmailSequenceService.ts`** (Partial)
  - References onboarding URL in email templates
  - Variable: `onboardingUrl: ${process.env.FRONTEND_URL}/onboarding`

- **`apps/backend/src/services/EmailTemplateService.ts`** (Partial)
  - Welcome email template includes onboarding link
  - Button: "Start Onboarding" linking to onboarding URL

### Testing & Development

#### Test Files
- **`apps/backend/test-onboarding.js`**
  - Manual test script for onboarding service
  - Dependencies: mongoose, User model, OnboardingService
  - Tests: getProgress, updateStep, completeOnboarding, needsOnboarding
  - Creates/cleans up test user data

### External Dependencies

#### Frontend Dependencies
- **React Router**: Navigation between steps and pages
- **Zustand**: State management with persistence
- **Lucide React**: Icons for UI components
- **API Client**: HTTP requests to backend

#### Backend Dependencies
- **Express**: HTTP server and routing
- **Mongoose**: MongoDB ODM for data persistence
- **bcrypt**: Password hashing (User model)
- **Zod**: Schema validation (User model)

## File Relationships & Dependencies

### Dependency Graph

```
OnboardingPage.tsx
├── OnboardingWizard.tsx (main orchestrator)
│   ├── onboarding.store.ts (state management)
│   │   ├── onboarding.types.ts (type definitions)
│   │   └── api-client (HTTP requests)
│   ├── OnboardingProgress.tsx (progress indicator)
│   └── Step Components/
│       ├── WelcomeStep.tsx
│       ├── ConnectAccountsStep.tsx
│       ├── CreatePostStep.tsx
│       ├── InviteTeamStep.tsx
│       └── CompleteStep.tsx
└── auth.store.ts (user authentication state)

Backend API Flow:
onboarding.routes.ts
├── OnboardingController.ts (HTTP handlers)
│   └── OnboardingService.ts (business logic)
│       └── User.ts (data model)
└── auth.middleware.ts (authentication)
```

### Data Flow

1. **User Registration** → Redirects to `/onboarding`
2. **OnboardingPage** → Loads OnboardingWizard
3. **OnboardingWizard** → Fetches progress from API
4. **Step Components** → Update local state and call API
5. **OnboardingService** → Updates User model in database
6. **Completion** → Redirects to dashboard

### API Integration Points

- **Frontend Store** ↔ **Backend Routes**: RESTful API calls
- **Step Components** ↔ **Store Actions**: State updates
- **Router Protection** ↔ **User Model**: Onboarding status checks
- **Email Service** ↔ **Onboarding URL**: Welcome email integration

## Module Boundaries

### Included in Onboarding Module
- All files in `apps/frontend/src/components/onboarding/`
- Onboarding-specific store and types
- OnboardingPage component
- Backend onboarding routes, controllers, and services
- Onboarding fields in User model
- Related test files

### External Dependencies (Not Part of Module)
- Authentication system (auth.store.ts, auth middleware)
- User model (except onboarding fields)
- Router configuration (except onboarding route)
- API client infrastructure
- Email service infrastructure
- OAuth connection system (`/connect-v2`)
- Post composer (`/posts/create`)

### Integration Points
- **Authentication**: Requires authenticated user
- **OAuth**: Connects to social account linking
- **Post Creation**: Integrates with composer
- **Email**: Welcome emails include onboarding links
- **Navigation**: Router protection based on completion status

## Summary

The Onboarding Wizard module consists of **18 core files** across frontend and backend:

**Frontend (12 files):**
- 1 page component
- 1 main wizard component  
- 1 progress component
- 1 additional onboarding helper
- 5 step components
- 1 store
- 2 type definition files

**Backend (6 files):**
- 1 route definition
- 1 controller
- 1 service
- 1 model (partial - onboarding fields)
- 1 test file
- Route registration (partial)

The module is well-structured with clear separation of concerns, proper dependency management, and comprehensive coverage of the onboarding user journey from registration to completion.