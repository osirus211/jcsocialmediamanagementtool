# Manual Testing Checklist

**Date**: February 18, 2026  
**Tester**: _______________  
**Environment**: Local Docker  
**URLs**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- API Health: http://localhost:5000/health

---

## Pre-Testing Setup

- [ ] Docker Compose running (`docker compose up --build`)
- [ ] MongoDB healthy (check `docker compose ps`)
- [ ] Redis healthy (check `docker compose ps`)
- [ ] Backend running (check logs)
- [ ] Frontend running (check logs)
- [ ] Browser: Chrome/Firefox (latest)
- [ ] Browser console open (F12)
- [ ] Network tab open (for API calls)

---

## 1. Authentication Flow

### Sign Up
- [ ] Navigate to http://localhost:5173
- [ ] Click "Sign Up" or "Register"
- [ ] Fill in registration form:
  - [ ] Email: test@example.com
  - [ ] Password: Test123!@#
  - [ ] First Name: Test
  - [ ] Last Name: User
- [ ] Click "Sign Up"
- [ ] **Expected**: Redirected to dashboard or workspace creation
- [ ] **Check**: No console errors
- [ ] **Check**: Success message appears

### Login
- [ ] Logout (if logged in)
- [ ] Navigate to login page
- [ ] Enter credentials:
  - [ ] Email: test@example.com
  - [ ] Password: Test123!@#
- [ ] Click "Login"
- [ ] **Expected**: Redirected to dashboard
- [ ] **Check**: User name appears in header
- [ ] **Check**: No console errors

### Logout
- [ ] Click user menu/profile
- [ ] Click "Logout"
- [ ] **Expected**: Redirected to login page
- [ ] **Check**: Cannot access protected routes

---

## 2. Workspace Management

### Create Workspace
- [ ] Login as test user
- [ ] Navigate to workspaces page
- [ ] Click "Create Workspace"
- [ ] Fill in form:
  - [ ] Name: Test Workspace
  - [ ] Description: Testing workspace
- [ ] Click "Create"
- [ ] **Expected**: Workspace created
- [ ] **Expected**: Redirected to workspace
- [ ] **Check**: Success toast appears
- [ ] **Check**: Workspace appears in list

### Switch Workspace
- [ ] Create second workspace (if needed)
- [ ] Click workspace switcher
- [ ] Select different workspace
- [ ] **Expected**: Workspace switches
- [ ] **Expected**: Data updates for new workspace
- [ ] **Check**: No console errors

---

## 3. Social Account Connection

### Connect Account (Mock)
- [ ] Navigate to "Social Accounts" page
- [ ] Click "Connect Account"
- [ ] Select platform (Twitter/LinkedIn/Facebook/Instagram)
- [ ] **Expected**: OAuth flow starts (or mock connection)
- [ ] **Expected**: Account appears in list
- [ ] **Check**: Account status shows "Connected"
- [ ] **Check**: Platform icon displays correctly

### Disconnect Account
- [ ] Click "Disconnect" on connected account
- [ ] Confirm disconnection
- [ ] **Expected**: Account removed from list
- [ ] **Check**: Confirmation modal appears
- [ ] **Check**: Success message

---

## 4. Post Composer

### Create Draft
- [ ] Navigate to "Create Post" or Composer
- [ ] Write post content: "This is a test post #testing"
- [ ] **Expected**: Auto-save indicator appears
- [ ] **Expected**: "Saving..." → "Saved" transition
- [ ] **Check**: No console errors
- [ ] **Check**: Draft saved (refresh page to verify)

### Select Platform
- [ ] In composer, select platform(s)
- [ ] **Expected**: Platform buttons highlight when selected
- [ ] **Expected**: Can select multiple platforms
- [ ] **Check**: Only connected platforms are selectable

### Add Media
- [ ] Click "Add Media" button
- [ ] Upload image (< 10MB)
- [ ] **Expected**: Upload progress bar appears
- [ ] **Expected**: Image preview shows
- [ ] **Expected**: Success message
- [ ] **Check**: Image attached to post

### Schedule Post
- [ ] Select "Schedule" option
- [ ] Pick future date/time
- [ ] Click "Schedule"
- [ ] **Expected**: Post scheduled
- [ ] **Expected**: Success toast appears
- [ ] **Expected**: Redirected to calendar or post list
- [ ] **Check**: Post appears in calendar

### Publish Now
- [ ] Create new post
- [ ] Select "Publish Now"
- [ ] Click "Publish"
- [ ] **Expected**: Post queued for immediate publish
- [ ] **Expected**: Success message
- [ ] **Check**: Post status changes to "Publishing" or "Published"

### Queue Post
- [ ] Create new post
- [ ] Select "Add to Queue"
- [ ] Click "Queue"
- [ ] **Expected**: Post added to queue
- [ ] **Expected**: Success message
- [ ] **Check**: Post appears in queue

---

## 5. Calendar View

### View Calendar
- [ ] Navigate to "Calendar" page
- [ ] **Expected**: Calendar displays with current month
- [ ] **Expected**: Scheduled posts appear on dates
- [ ] **Check**: Posts show correct date/time
- [ ] **Check**: Status badges display correctly

### Switch Views
- [ ] Click "Month" view
- [ ] **Expected**: Monthly calendar displays
- [ ] Click "Week" view
- [ ] **Expected**: Weekly calendar displays
- [ ] **Check**: Posts display in both views

### Drag & Drop Reschedule
- [ ] Drag a scheduled post to different date
- [ ] **Expected**: Post moves to new date
- [ ] **Expected**: Confirmation or auto-save
- [ ] **Expected**: Success message
- [ ] **Check**: Post rescheduled in backend

### Click Post to Edit
- [ ] Click on a scheduled post
- [ ] **Expected**: Composer opens with post data
- [ ] **Expected**: Can edit content
- [ ] **Expected**: Can reschedule
- [ ] **Check**: Changes save correctly

---

## 6. Media Library

### Upload Media
- [ ] Navigate to "Media Library"
- [ ] Drag & drop image file
- [ ] **Expected**: Upload progress shows
- [ ] **Expected**: Image appears in grid
- [ ] **Expected**: Success toast
- [ ] **Check**: File validation works (try invalid file)

### Browse Media
- [ ] Scroll through media grid
- [ ] **Expected**: Images load (lazy loading)
- [ ] **Expected**: Pagination works (if > 20 items)
- [ ] **Check**: Thumbnails display correctly

### Delete Media
- [ ] Click delete on a media item
- [ ] **Expected**: Confirmation modal appears
- [ ] Confirm deletion
- [ ] **Expected**: Media removed from grid
- [ ] **Expected**: Success message
- [ ] **Check**: Media deleted from backend

### Select Media in Composer
- [ ] Open composer
- [ ] Click "Add Media"
- [ ] Select from library
- [ ] **Expected**: Media selector modal opens
- [ ] Select media item(s)
- [ ] Click "Select"
- [ ] **Expected**: Media attached to post
- [ ] **Check**: Can select multiple (if allowed)

---

## 7. Analytics Dashboard

### View Analytics
- [ ] Navigate to "Analytics" page
- [ ] **Expected**: Overview cards display
- [ ] **Expected**: Activity chart shows (if data exists)
- [ ] **Expected**: Platform distribution shows
- [ ] **Expected**: Recent posts table shows
- [ ] **Check**: Empty state if no data

### Change Time Range
- [ ] Select "Last 7 days"
- [ ] **Expected**: Data updates
- [ ] Select "Last 30 days"
- [ ] **Expected**: Data updates
- [ ] Select "Last 90 days"
- [ ] **Expected**: Data updates
- [ ] **Check**: Charts update correctly

### Refresh Data
- [ ] Click "Refresh" button
- [ ] **Expected**: Loading indicator
- [ ] **Expected**: Data refreshes
- [ ] **Check**: No errors

---

## 8. Billing & Subscriptions

### View Plans
- [ ] Navigate to "Pricing" page
- [ ] **Expected**: All plans display (Free, Pro, Team, Enterprise)
- [ ] **Expected**: Current plan highlighted
- [ ] **Expected**: Features listed
- [ ] **Expected**: Prices shown
- [ ] **Check**: Monthly/yearly toggle works

### Upgrade Flow (Test Mode)
- [ ] Click "Upgrade" on Pro plan
- [ ] **Expected**: Redirected to Stripe Checkout (test mode)
- [ ] **Expected**: Checkout session created
- [ ] **Check**: No duplicate checkout if clicked twice
- [ ] **Note**: Don't complete payment (test mode)

### View Billing Dashboard
- [ ] Navigate to "Billing" page
- [ ] **Expected**: Current subscription shows
- [ ] **Expected**: Usage meters display
- [ ] **Expected**: Plan features listed
- [ ] **Check**: Usage percentages correct

### Manage Billing (Portal)
- [ ] Click "Manage Billing"
- [ ] **Expected**: Redirected to Stripe Customer Portal
- [ ] **Expected**: Can view invoices (if any)
- [ ] **Expected**: Can update payment method
- [ ] **Check**: Returns to billing page after

---

## 9. Failed Posts & Retry

### View Failed Posts
- [ ] Navigate to "Failed Posts" page
- [ ] **Expected**: List of failed posts (if any)
- [ ] **Expected**: Error messages display
- [ ] **Expected**: Retry buttons available
- [ ] **Check**: Empty state if no failed posts

### Retry Single Post
- [ ] Click "Retry" on a failed post
- [ ] **Expected**: Retry initiated
- [ ] **Expected**: Loading indicator
- [ ] **Expected**: Success or error message
- [ ] **Check**: Post removed from failed list if successful

### Bulk Retry
- [ ] Select multiple failed posts
- [ ] Click "Retry All"
- [ ] **Expected**: Bulk retry initiated
- [ ] **Expected**: Progress indicator
- [ ] **Expected**: Success message
- [ ] **Check**: Posts processed correctly

### Delete Failed Post
- [ ] Click "Delete" on failed post
- [ ] **Expected**: Confirmation modal
- [ ] Confirm deletion
- [ ] **Expected**: Post removed
- [ ] **Expected**: Success message

---

## 10. Error Handling

### Network Error
- [ ] Disconnect internet
- [ ] Try to create post
- [ ] **Expected**: Error message appears
- [ ] **Expected**: Retry option available
- [ ] **Check**: No crash or white screen

### Validation Error
- [ ] Try to schedule post in past
- [ ] **Expected**: Validation error
- [ ] **Expected**: Clear error message
- [ ] **Check**: Form highlights error

### Token Expired
- [ ] (Simulate by clearing cookies)
- [ ] Try to access protected route
- [ ] **Expected**: Redirected to login
- [ ] **Expected**: Can login again
- [ ] **Check**: State preserved (if possible)

### Server Error
- [ ] (Simulate by stopping backend)
- [ ] Try to load data
- [ ] **Expected**: Error message
- [ ] **Expected**: Retry option
- [ ] **Check**: Error boundary catches errors

---

## 11. UX & Feedback

### First Post Onboarding
- [ ] Create new user with no posts
- [ ] **Expected**: Onboarding banner appears
- [ ] Click "Create Your First Post"
- [ ] **Expected**: Redirected to composer
- [ ] **Check**: Can dismiss onboarding

### Empty States
- [ ] Check empty states for:
  - [ ] No posts
  - [ ] No media
  - [ ] No analytics
  - [ ] No failed posts
  - [ ] No social accounts
- [ ] **Expected**: Helpful messages
- [ ] **Expected**: Action buttons
- [ ] **Check**: Icons and styling correct

### Success Toasts
- [ ] Verify success toasts appear for:
  - [ ] Post scheduled
  - [ ] Post published
  - [ ] Draft saved
  - [ ] Media uploaded
  - [ ] Account connected
- [ ] **Expected**: Auto-dismiss after 3 seconds
- [ ] **Expected**: Can manually close
- [ ] **Check**: Positioning correct (bottom-right)

### Loading States
- [ ] Check loading indicators for:
  - [ ] Page loads
  - [ ] API calls
  - [ ] Form submissions
  - [ ] File uploads
- [ ] **Expected**: Spinners or skeletons
- [ ] **Expected**: Buttons disabled during loading
- [ ] **Check**: No UI freeze

### Confirmation Modals
- [ ] Verify confirmations for:
  - [ ] Delete post
  - [ ] Delete media
  - [ ] Cancel subscription
  - [ ] Disconnect account
- [ ] **Expected**: Clear warning message
- [ ] **Expected**: Confirm/Cancel buttons
- [ ] **Check**: Can cancel action

---

## 12. Performance

### Page Load Speed
- [ ] Measure initial page load
- [ ] **Expected**: < 3 seconds
- [ ] **Check**: No blocking resources

### API Response Time
- [ ] Check network tab for API calls
- [ ] **Expected**: < 1 second for most calls
- [ ] **Check**: No failed requests

### Image Loading
- [ ] Scroll through media library
- [ ] **Expected**: Lazy loading works
- [ ] **Expected**: No layout shift
- [ ] **Check**: Smooth scrolling

### Auto-Save Performance
- [ ] Type rapidly in composer
- [ ] **Expected**: Debounced save (1 second)
- [ ] **Expected**: No lag or freeze
- [ ] **Check**: Save indicator updates

---

## 13. Mobile Responsiveness

### Mobile View (Resize Browser)
- [ ] Resize browser to mobile width (375px)
- [ ] Check pages:
  - [ ] Dashboard
  - [ ] Composer
  - [ ] Calendar
  - [ ] Media library
  - [ ] Analytics
  - [ ] Billing
- [ ] **Expected**: Responsive layout
- [ ] **Expected**: No horizontal scroll
- [ ] **Expected**: Touch-friendly buttons
- [ ] **Check**: Navigation works

---

## 14. Browser Compatibility

### Chrome
- [ ] Test all critical flows
- [ ] **Expected**: Everything works
- [ ] **Check**: No console errors

### Firefox
- [ ] Test all critical flows
- [ ] **Expected**: Everything works
- [ ] **Check**: No console errors

### Safari (if available)
- [ ] Test all critical flows
- [ ] **Expected**: Everything works
- [ ] **Check**: No console errors

### Edge
- [ ] Test all critical flows
- [ ] **Expected**: Everything works
- [ ] **Check**: No console errors

---

## 15. Security

### Protected Routes
- [ ] Try to access /posts without login
- [ ] **Expected**: Redirected to login
- [ ] **Check**: Cannot bypass authentication

### XSS Prevention
- [ ] Try to inject script in post content: `<script>alert('xss')</script>`
- [ ] **Expected**: Script escaped/sanitized
- [ ] **Expected**: No alert appears
- [ ] **Check**: Content displays as text

### CSRF Protection
- [ ] Check API calls have proper headers
- [ ] **Expected**: Auth tokens included
- [ ] **Check**: Backend validates tokens

---

## Issues Found

| # | Page/Feature | Issue Description | Severity | Status |
|---|--------------|-------------------|----------|--------|
| 1 |              |                   |          |        |
| 2 |              |                   |          |        |
| 3 |              |                   |          |        |

**Severity Levels**:
- **Critical**: Blocks core functionality
- **High**: Major feature broken
- **Medium**: Minor feature issue
- **Low**: Cosmetic or edge case

---

## Test Summary

**Date Completed**: _______________  
**Total Tests**: _____ / _____  
**Passed**: _____  
**Failed**: _____  
**Blocked**: _____  

**Critical Issues**: _____  
**High Issues**: _____  
**Medium Issues**: _____  
**Low Issues**: _____  

**Overall Status**: ⬜ PASS | ⬜ FAIL | ⬜ BLOCKED

**Recommendation**: ⬜ READY FOR PRODUCTION | ⬜ NEEDS FIXES | ⬜ MAJOR REWORK

**Notes**:
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________

---

**Tester Signature**: _______________  
**Date**: _______________
