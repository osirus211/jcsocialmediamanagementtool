# Phase 2.5 Frontend Authentication - Testing Guide

## Prerequisites

Ensure Docker is installed and services are running:

```bash
docker compose up
```

This will start:
- MongoDB (port 27017)
- Redis (port 6379)
- Backend API (port 5000)
- Frontend (port 5173)

---

## Test Scenarios

### 1. Registration Flow

**Steps:**
1. Open browser to http://localhost:5173
2. You should be redirected to `/auth/login`
3. Click "Sign up" link
4. Fill in the registration form:
   - First Name: `John`
   - Last Name: `Doe`
   - Email: `john.doe@example.com`
   - Password: `SecurePass123`
5. Click "Create Account"

**Expected Results:**
- ✅ Form validates input in real-time
- ✅ Password requirements are shown
- ✅ On submit, loading state shows "Creating account..."
- ✅ After success, redirects to dashboard (`/`)
- ✅ Header shows "John Doe"
- ✅ Logout button is visible

**Validation Tests:**
- Try empty fields → Should show "required" errors
- Try invalid email → Should show "Invalid email address"
- Try weak password (e.g., "pass") → Should show password requirements error
- Try password without uppercase → Should show error
- Try password without number → Should show error

---

### 2. Login Flow

**Steps:**
1. If logged in, click "Logout" button
2. Should redirect to `/auth/login`
3. Fill in login form:
   - Email: `john.doe@example.com`
   - Password: `SecurePass123`
4. Click "Sign In"

**Expected Results:**
- ✅ Form validates input
- ✅ On submit, loading state shows "Signing in..."
- ✅ After success, redirects to dashboard
- ✅ Header shows user name
- ✅ Logout button is visible

**Error Tests:**
- Try wrong password → Should show "Login failed" error
- Try non-existent email → Should show error
- Try empty fields → Should show validation errors

---

### 3. Session Restore

**Steps:**
1. Login to the application
2. Verify you're on the dashboard
3. Refresh the page (F5 or Ctrl+R)

**Expected Results:**
- ✅ Should remain logged in
- ✅ Should NOT redirect to login page
- ✅ Should see dashboard immediately
- ✅ User name should still be in header
- ✅ No flicker or loading screen

**Technical Details:**
- AuthProvider calls `/auth/me` on mount
- If 401, attempts token refresh
- If refresh succeeds, retries `/auth/me`
- Access token restored in memory
- User data loaded from localStorage

---

### 4. Protected Routes

**Steps:**
1. Logout from the application
2. Manually navigate to http://localhost:5173/
3. Try to access dashboard

**Expected Results:**
- ✅ Should redirect to `/auth/login`
- ✅ Should NOT see dashboard
- ✅ After login, should redirect back to dashboard

**Additional Tests:**
- While logged out, try accessing any protected route
- Should always redirect to login
- After login, should redirect to originally requested route

---

### 5. Public Routes

**Steps:**
1. Login to the application
2. Manually navigate to http://localhost:5173/auth/login
3. Try to access login page while authenticated

**Expected Results:**
- ✅ Should redirect to dashboard (`/`)
- ✅ Should NOT see login page
- ✅ Same behavior for `/auth/register`

---

### 6. Logout Flow

**Steps:**
1. Login to the application
2. Click "Logout" button in header

**Expected Results:**
- ✅ Should call `/auth/logout` API
- ✅ Should clear auth state
- ✅ Should redirect to `/auth/login`
- ✅ User name should disappear from header
- ✅ Trying to access dashboard should redirect to login

**Technical Details:**
- Logout API invalidates refresh token
- Auth store clears user and access token
- localStorage is cleared
- All auth state is reset

---

### 7. Token Refresh (Advanced)

**Setup:**
This test requires modifying token expiry for testing purposes.

**Option A: Wait 15 minutes**
1. Login to the application
2. Wait 15 minutes (access token expires)
3. Make an API request (navigate to a page that fetches data)

**Option B: Modify token expiry (for testing)**
1. In `apps/backend/src/services/TokenService.ts`
2. Change `expiresIn: '15m'` to `expiresIn: '30s'`
3. Restart backend
4. Login and wait 30 seconds
5. Navigate to a page that makes API requests

**Expected Results:**
- ✅ API client detects 401 error
- ✅ Automatically calls `/auth/refresh`
- ✅ Receives new access token
- ✅ Retries original request
- ✅ User remains logged in
- ✅ No visible error or redirect

**Technical Details:**
- API client intercepts 401 responses
- Queues concurrent requests during refresh
- Prevents multiple refresh calls
- Updates access token in store
- Retries all queued requests

---

### 8. Form Validation

**Registration Form Tests:**

| Input | Expected Error |
|-------|---------------|
| Empty first name | "First name is required" |
| Empty last name | "Last name is required" |
| Empty email | "Invalid email address" |
| Invalid email (e.g., "test") | "Invalid email address" |
| Empty password | "Password must be at least 8 characters" |
| Short password (e.g., "Pass1") | "Password must be at least 8 characters" |
| No uppercase (e.g., "password123") | "Password must contain at least one uppercase letter" |
| No lowercase (e.g., "PASSWORD123") | "Password must contain at least one lowercase letter" |
| No number (e.g., "Password") | "Password must contain at least one number" |

**Login Form Tests:**

| Input | Expected Error |
|-------|---------------|
| Empty email | "Invalid email address" |
| Invalid email | "Invalid email address" |
| Empty password | "Password is required" |

---

### 9. Dark Mode

**Steps:**
1. If theme toggle exists, switch between light and dark modes
2. Test all auth pages in both modes

**Expected Results:**
- ✅ Login page adapts to dark mode
- ✅ Register page adapts to dark mode
- ✅ Text remains readable
- ✅ Buttons have proper contrast
- ✅ Input fields are styled correctly
- ✅ Error messages are visible

**Color Scheme:**
- Light mode: White background, dark text
- Dark mode: Dark gray background, light text
- Inputs: Border changes, background adapts
- Buttons: Blue with proper contrast

---

### 10. Responsive Design

**Steps:**
1. Open browser DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test different screen sizes:
   - Mobile (375px)
   - Tablet (768px)
   - Desktop (1920px)

**Expected Results:**
- ✅ Forms are readable on mobile
- ✅ Buttons are touch-friendly
- ✅ Text doesn't overflow
- ✅ Layout adapts to screen size
- ✅ Registration form grid collapses on mobile

---

### 11. Error Handling

**Network Error Test:**
1. Stop the backend server
2. Try to login or register

**Expected Results:**
- ✅ Should show error message
- ✅ Should not crash
- ✅ Should remain on form page
- ✅ User can retry after backend restarts

**API Error Test:**
1. Try to register with existing email
2. Try to login with wrong password

**Expected Results:**
- ✅ Should show specific error message
- ✅ Should not clear form
- ✅ User can correct and retry

---

### 12. Loading States

**Steps:**
1. Open browser DevTools → Network tab
2. Throttle network to "Slow 3G"
3. Try to login or register

**Expected Results:**
- ✅ Button shows loading text ("Signing in..." or "Creating account...")
- ✅ Button is disabled during submission
- ✅ Form cannot be submitted multiple times
- ✅ Loading state clears after response

---

### 13. Accessibility

**Keyboard Navigation:**
1. Use Tab key to navigate form
2. Use Enter to submit

**Expected Results:**
- ✅ Can navigate all fields with Tab
- ✅ Focus is visible
- ✅ Enter submits form
- ✅ Escape closes modals (if any)

**Screen Reader:**
1. Use screen reader (NVDA, JAWS, or VoiceOver)
2. Navigate form

**Expected Results:**
- ✅ Labels are announced
- ✅ Errors are announced
- ✅ Button states are announced
- ✅ Form structure is clear

---

## API Endpoint Tests

### Register Endpoint

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Expected Response:**
```json
{
  "user": {
    "_id": "...",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "role": "owner"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login Endpoint

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123"
  }'
```

**Expected Response:**
```json
{
  "user": {
    "_id": "...",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Me Endpoint

```bash
curl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "user": {
    "_id": "...",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  }
}
```

### Refresh Endpoint

```bash
curl -X POST http://localhost:5000/api/v1/auth/refresh \
  -H "Cookie: refreshToken=YOUR_REFRESH_TOKEN"
```

**Expected Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Logout Endpoint

```bash
curl -X POST http://localhost:5000/api/v1/auth/logout \
  -H "Cookie: refreshToken=YOUR_REFRESH_TOKEN"
```

**Expected Response:**
```json
{
  "message": "Logged out successfully"
}
```

---

## Browser Console Tests

### Check Auth Store

```javascript
// Open browser console (F12)
// Access auth store
const { useAuthStore } = await import('/src/store/auth.store.ts');
const store = useAuthStore.getState();

// Check state
console.log('User:', store.user);
console.log('Is Authenticated:', store.isAuthenticated);
console.log('Access Token:', store.accessToken ? 'Present' : 'Missing');

// Test login
await store.login('test@example.com', 'SecurePass123');

// Test logout
await store.logout();
```

### Check API Client

```javascript
// Import API client
const { apiClient } = await import('/src/lib/api-client.ts');

// Test authenticated request
const response = await apiClient.get('/auth/me');
console.log('Me Response:', response);

// Test refresh
const refreshResponse = await apiClient.post('/auth/refresh', {});
console.log('Refresh Response:', refreshResponse);
```

---

## Common Issues & Solutions

### Issue: "Cannot find module" errors
**Solution:** Run `npm install` in `apps/frontend` directory

### Issue: Backend not responding
**Solution:** Check if Docker containers are running with `docker compose ps`

### Issue: CORS errors
**Solution:** Verify backend CORS configuration allows `http://localhost:5173`

### Issue: Token refresh not working
**Solution:** Check browser cookies, ensure `withCredentials: true` in API client

### Issue: Session not restoring
**Solution:** Check browser localStorage for user data, verify `/auth/me` endpoint

### Issue: Validation not working
**Solution:** Verify Zod schemas are imported correctly, check form resolver

---

## Success Criteria

All tests pass when:
- ✅ User can register successfully
- ✅ User can login successfully
- ✅ User can logout successfully
- ✅ Session restores on page refresh
- ✅ Protected routes redirect to login
- ✅ Public routes redirect to dashboard when authenticated
- ✅ Token refresh works automatically
- ✅ Form validation works correctly
- ✅ Error handling works properly
- ✅ Loading states display correctly
- ✅ Dark mode works
- ✅ Responsive design works
- ✅ Accessibility features work

---

## Next Steps After Testing

Once all tests pass:
1. Mark Phase 2.5 as complete
2. Document any issues found
3. Proceed to Phase 3: Workspace & Multi-Tenant Architecture

---

**Happy Testing! 🚀**

