# Onboarding Wizard - Complete User Flow Analysis

## Overview
This document maps the complete user journey through the 5-step onboarding wizard, documenting all navigation paths, decision points, branching logic, and expected vs actual behaviors based on Task 1 findings.

## Entry Points to Onboarding Wizard

### 1. New User Registration
- **Path**: User registers → Email verification → Auto-redirect to `/onboarding`
- **Trigger**: `user.onboardingCompleted = false` (default for new users)
- **Auth Check**: ProtectedRoute enforces authentication before onboarding access

### 2. Existing User (Incomplete Onboarding)
- **Path**: User logs in → ProtectedRoute detects incomplete onboarding → Auto-redirect to `/onboarding`
- **Condition**: `user.onboardingCompleted = false` AND `location.pathname !== '/onboarding'`
- **Behavior**: Cannot access other app areas until onboarding completed

### 3. Direct URL Access
- **Path**: User navigates directly to `/onboarding`
- **Auth Check**: Requires authentication, redirects to login if not authenticated
- **Completion Check**: Redirects to dashboard if onboarding already completed

### 4. OAuth Registration Flow
- **Path**: OAuth signup → Account creation → Auto-redirect to `/onboarding`
- **Integration**: Works with existing OAuth providers (Google, Facebook, etc.)

## Complete Step-by-Step User Flow

### Step 0: Welcome Step (Personalization)
**Purpose**: Collect user role, team size, and primary goal for personalized experience

#### User Interface Elements
- **Role Selection**: 4 options (Founder/CEO, Marketer, Agency Owner, Content Creator)
- **Team Size Selection**: 4 options (Just me, 2-5 people, 6-20 people, 20+ people)  
- **Primary Goal Selection**: 4 options (Grow audience, Save time, Manage clients, Increase sales)
- **Continue Button**: Disabled until all 3 selections made

#### Navigation Options
- **Next**: Continue to Step 1 (Connect Accounts)
  - **Validation**: All fields required before advancement
  - **Data Storage**: Updates `currentStepData` in Zustand store with selections
  - **API Call**: `PUT /api/v1/onboarding/step` with `step: 1`
- **Skip Setup**: Skip entire onboarding → Dashboard
  - **API Call**: `POST /api/v1/onboarding/skip`
  - **Result**: Sets `onboardingCompleted = true`, `onboardingStep = 5`

#### Expected Behavior
- Form validation prevents advancement without all selections
- Data persists in localStorage via Zustand persistence
- Smooth transition to next step with loading state
- Progress indicator updates to show Step 1 as current

#### Current Issues (From Task 1)
- **CRITICAL**: Next button may not advance to Step 1 (main bug)
- Console errors during step rendering
- Pre-filled data appearing for new users (should be empty)
- Validation bypass allowing advancement with incomplete forms

### Step 1: Connect Accounts Step (Social Media Integration)
**Purpose**: Connect at least one social media account for posting

#### User Interface Elements
- **Platform Grid**: 6 social platforms (Twitter, Facebook, Instagram, LinkedIn, YouTube, TikTok)
- **Connection Status**: Shows "Connected" with checkmark or "Connect" button
- **Info Tip**: Explains accounts can be connected later from settings

#### Navigation Options
- **Back**: Return to Step 0 (Welcome)
  - **Data Preservation**: Should maintain Step 0 selections
  - **API Call**: `PUT /api/v1/onboarding/step` with `step: 0`
- **Connect Platform**: Navigate to OAuth flow
  - **Path**: `/connect-v2?platform={platformId}&return=/onboarding`
  - **Return Flow**: OAuth completion returns to onboarding
- **Skip for now**: Continue without connecting accounts
  - **Allowed**: Can proceed with 0 connected accounts
- **Continue**: Advance to Step 2 (Create Post)
  - **Requirement**: At least 1 connected account (button disabled otherwise)
  - **API Call**: `PUT /api/v1/onboarding/step` with `step: 2`

#### Expected Behavior
- OAuth integration works seamlessly with return to onboarding
- Connected accounts persist and display correctly
- Can skip step if no accounts connected
- Back button preserves previous step data

#### Current Issues (From Task 1)
- OAuth callback integration may not return properly to onboarding
- Connected account status may not update correctly
- Back button may lose Step 0 data
- Step advancement may fail even with connected accounts

### Step 2: Create Post Step (First Content Creation)
**Purpose**: Create first social media post using the composer

#### User Interface Elements
- **Composer Preview**: Visual representation of post creation area
- **Open Composer Button**: Launches full composer in new context
- **Feature Highlights**: Shows "Publish Now" and "Schedule Later" options
- **Success State**: Displays when post has been created

#### Navigation Options
- **Back**: Return to Step 1 (Connect Accounts)
  - **Data Preservation**: Should maintain connected accounts
  - **API Call**: `PUT /api/v1/onboarding/step` with `step: 1`
- **Open Composer**: Navigate to post creation
  - **Path**: `/posts/create?onboarding=true`
  - **Context**: Onboarding flag indicates return flow
  - **Return Mechanism**: Composer completion should return to onboarding
- **Skip for now**: Continue without creating post
  - **Allowed**: Can proceed without post creation
- **Continue**: Advance to Step 3 (Invite Team)
  - **API Call**: `PUT /api/v1/onboarding/step` with `step: 3`

#### Expected Behavior
- Composer integration maintains onboarding context
- Post creation status updates correctly upon return
- Skip option allows progression without post
- Success state displays when post completed

#### Current Issues (From Task 1)
- Composer may not return to onboarding after post creation
- Post creation status may not update correctly
- Navigation between composer and onboarding may break state
- Step advancement may fail regardless of post status

### Step 3: Invite Team Step (Team Collaboration)
**Purpose**: Invite team members to collaborate on social media management

#### User Interface Elements
- **Email Input**: Add team member email addresses
- **Role Selection**: Choose Admin or Member role for each invite
- **Team List**: Shows added members before sending invites
- **Validation**: Email format validation with error messages
- **Invite Counter**: Shows number of members to invite

#### Navigation Options
- **Back**: Return to Step 2 (Create Post)
  - **Data Preservation**: Should maintain post creation status
  - **API Call**: `PUT /api/v1/onboarding/step` with `step: 2`
- **Add Member**: Add email to invitation list
  - **Validation**: Valid email format required
  - **Duplicate Check**: Prevents adding same email twice
- **Remove Member**: Remove email from invitation list
- **Skip for now**: Continue without inviting team
  - **Allowed**: Can proceed with 0 team invitations
- **Invite X members**: Send invitations and advance
  - **API Call**: Team invitation API (TODO: not implemented)
  - **Advancement**: `PUT /api/v1/onboarding/step` with `step: 4`
- **Continue**: Advance if no members added
  - **API Call**: `PUT /api/v1/onboarding/step` with `step: 4`

#### Expected Behavior
- Email validation works correctly
- Team member list management functions properly
- Invitation API sends emails to team members
- Can skip step if working solo

#### Current Issues (From Task 1)
- Team invitation API not implemented (TODO comment in code)
- Email validation may have edge cases
- Step advancement may fail after invitation attempts
- Loading states during invitation process may be missing

### Step 4: Complete Step (Onboarding Completion)
**Purpose**: Celebrate completion and provide next action options

#### User Interface Elements
- **Confetti Animation**: 3-second celebration animation with emojis
- **Success Message**: Personalized welcome with user's first name
- **Setup Summary**: Grid showing completion status of all steps
- **Quick Actions**: 3 action buttons for immediate next steps
- **Main CTA**: "Go to Dashboard" button
- **Help Links**: Links to help center and support

#### Navigation Options
- **Quick Actions**:
  - **Create Your Next Post**: Navigate to `/posts/create`
  - **View Analytics**: Navigate to `/analytics`
  - **Explore Features**: Navigate to `/` (dashboard)
- **Go to Dashboard**: Complete onboarding and navigate to main app
  - **API Call**: `POST /api/v1/onboarding/complete`
  - **Result**: Sets `onboardingCompleted = true`, `onboardingStep = 5`
  - **Navigation**: Redirect to `/` (dashboard)

#### Expected Behavior
- Confetti animation plays on step load
- Setup summary accurately reflects completed steps
- Quick actions navigate to correct destinations
- Dashboard redirect works after completion
- User cannot return to onboarding after completion

#### Current Issues (From Task 1)
- Completion API call may fail
- Dashboard redirect may not work properly
- Setup summary may show incorrect completion status
- User may be able to re-access onboarding after completion

## Navigation Patterns & Decision Points

### Forward Navigation (Next Button)
**Standard Flow**: Step 0 → Step 1 → Step 2 → Step 3 → Step 4 → Dashboard

#### Decision Logic
1. **Validation Check**: Each step validates required fields/actions
2. **Data Storage**: Update `currentStepData` in Zustand store
3. **API Call**: `PUT /api/v1/onboarding/step` with next step number
4. **State Update**: Update `currentStep` and `completedSteps` arrays
5. **UI Transition**: Show loading state during API call, then render next step

#### Current Issues
- **CRITICAL**: Next button advancement failing across all steps
- API calls may be failing or not updating state correctly
- Loading states may not display properly
- State transitions may be broken

### Backward Navigation (Back Button)
**Available**: Steps 1, 2, 3 (not available on Step 0 or Step 4)

#### Decision Logic
1. **Step Validation**: Ensure not on first step (Step 0)
2. **Data Preservation**: Maintain current step data in store
3. **API Call**: `PUT /api/v1/onboarding/step` with previous step number
4. **State Update**: Update `currentStep`, maintain `completedSteps`
5. **UI Transition**: Render previous step with preserved data

#### Current Issues
- Back button may lose entered data from current step
- API calls for backward navigation may fail
- State preservation may not work correctly
- Previous step data may not display properly

### Skip Navigation (Skip Setup / Skip for now)
**Global Skip**: Available on all steps via "Skip setup" header button
**Step Skip**: Available on Steps 1, 2, 3 via "Skip for now" buttons

#### Decision Logic
- **Global Skip**: Complete onboarding entirely → Dashboard
- **Step Skip**: Advance to next step without completing current step requirements

#### Current Issues
- Skip functionality may not work correctly
- Global skip may not set completion status properly
- Step skips may not advance correctly

### Progress Indicator Navigation
**Clickable Steps**: Users can click on progress indicators to jump between steps

#### Decision Logic
1. **Access Control**: Only allow clicks on completed steps or next step
2. **State Validation**: Ensure step is accessible based on completion status
3. **Direct Navigation**: Jump directly to clicked step without intermediate API calls

#### Current Issues
- Progress indicator clicks may not work
- Access control may not be enforced properly
- Direct navigation may break step flow

## External System Integration Points

### 1. OAuth Connection System
- **Entry Point**: Step 1 "Connect" buttons
- **Flow**: `/connect-v2?platform={platform}&return=/onboarding`
- **Return**: Should return to onboarding with updated connection status
- **Issues**: Return flow may not work, connection status may not update

### 2. Post Composer Integration  
- **Entry Point**: Step 2 "Open Composer" button
- **Flow**: `/posts/create?onboarding=true`
- **Return**: Should return to onboarding with post creation status
- **Issues**: Return flow may not work, creation status may not update

### 3. Authentication System
- **Integration**: ProtectedRoute enforces auth before onboarding access
- **Completion Check**: Redirects completed users away from onboarding
- **Session Management**: Handles session expiry during onboarding
- **Issues**: Session expiry may not be handled gracefully

### 4. Email Service Integration
- **Team Invitations**: Step 3 should send invitation emails
- **Status**: Currently not implemented (TODO in code)
- **Welcome Emails**: May include onboarding links

## State Management & Persistence

### Frontend State (Zustand Store)
- **Persisted**: `currentStepData` (localStorage)
- **Session**: `progress`, `isLoading`
- **Issues**: State may not persist correctly across page refresh

### Backend State (Database)
- **User Fields**: `onboardingStep`, `onboardingCompleted`
- **API Endpoints**: Progress tracking and step updates
- **Issues**: Database updates may fail, state sync may be broken

## Error Scenarios & Edge Cases

### Network Issues
- **Slow Connections**: Loading states may not display properly
- **API Failures**: Error handling may be insufficient
- **Timeout Handling**: Long requests may not have proper timeouts

### User Behavior Edge Cases
- **Page Refresh**: State should be preserved and restored
- **Tab Close/Reopen**: Should return to correct step
- **Browser Back Button**: May break onboarding flow
- **Direct URL Manipulation**: Manual navigation to `/onboarding/step/X` not handled

### Authentication Edge Cases
- **Session Expiry**: Mid-onboarding session expiry not handled gracefully
- **Token Refresh**: May interrupt onboarding flow
- **Logout/Login**: State may not be preserved across auth changes

### Data Validation Edge Cases
- **Null/Empty Values**: May not be handled properly
- **Invalid Inputs**: Validation may be incomplete
- **XSS/Injection**: Input sanitization may be missing

## Mobile & Accessibility Considerations

### Mobile Responsiveness
- **Viewport Issues**: Components may not render properly on mobile
- **Touch Interactions**: Button sizes and touch targets may be inadequate
- **Keyboard Navigation**: Mobile keyboard may interfere with UI

### Accessibility Compliance
- **Screen Readers**: ARIA labels may be missing
- **Keyboard Navigation**: Tab order and focus management may be broken
- **Color Contrast**: May not meet WCAG guidelines
- **Focus Indicators**: May not be visible for keyboard users

## Security Considerations

### Input Security
- **XSS Protection**: User inputs may not be properly sanitized
- **CSRF Protection**: State-changing requests may lack CSRF tokens
- **Data Validation**: Backend validation may not mirror frontend rules

### Authentication Security
- **Token Storage**: May use insecure storage methods
- **Session Management**: Session handling may have vulnerabilities
- **API Protection**: Endpoints may not be properly protected

## Summary of Critical Issues

Based on the analysis, the main issues preventing successful onboarding completion are:

1. **Next Button Advancement Failure**: Core navigation broken across all steps
2. **State Management Issues**: Data not persisting or syncing correctly
3. **External Integration Failures**: OAuth and composer return flows broken
4. **API Communication Problems**: Backend calls failing or not updating state
5. **Error Handling Gaps**: Insufficient error handling and user feedback
6. **Mobile/Accessibility Issues**: Poor experience on mobile and for assistive technologies
7. **Security Vulnerabilities**: Missing input sanitization and CSRF protection
8. **Edge Case Handling**: Poor handling of network issues, session expiry, and user behavior edge cases

The comprehensive fix must address all these areas to ensure a smooth, secure, and accessible onboarding experience for all users.