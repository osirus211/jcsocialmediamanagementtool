# Manual Testing Guide - Social Media Scheduler

## Server Status ✅

Both servers are running and ready for testing:

- **Frontend**: http://localhost:5173/
- **Backend API**: http://localhost:5000/api/v1
- **Backend Status**: Running (MongoDB connected, Redis disconnected - some features may be limited)

## Important Notes

⚠️ **Redis Status**: Redis is not connected, which means the following features will be disabled:
- Post scheduling and publishing queue
- Background workers
- Token refresh workers
- Missed post recovery

✅ **Available Features**: All UI features and API endpoints are accessible for navigation testing.

---

## Complete Feature Navigation Checklist

### 1. Authentication Module 🔐

#### Login Page
- **URL**: http://localhost:5173/auth/login
- **Test Items**:
  - [ ] Page loads correctly
  - [ ] Email input field visible
  - [ ] Password input field visible
  - [ ] "Remember me" checkbox
  - [ ] Login button
  - [ ] "Forgot password?" link
  - [ ] "Sign up" link
  - [ ] Form validation messages
  - [ ] OAuth buttons (Google, etc.)

#### Register Page
- **URL**: http://localhost:5173/auth/register
- **Test Items**:
  - [ ] Page loads correctly
  - [ ] Name input field
  - [ ] Email input field
  - [ ] Password input field
  - [ ] Confirm password field
  - [ ] Terms & conditions checkbox
  - [ ] Register button
  - [ ] "Already have an account?" link
  - [ ] Form validation

---

### 2. Dashboard Module 🏠

#### Main Dashboard
- **URL**: http://localhost:5173/
- **Test Items**:
  - [ ] Dashboard loads after login
  - [ ] Welcome message with user name
  - [ ] Quick stats cards (Total Posts, Scheduled, Published, Failed)
  - [ ] Recent posts list
  - [ ] Quick action buttons
  - [ ] Workspace selector visible
  - [ ] Navigation sidebar visible

---

### 3. Workspace Management Module ⚙️

#### Workspace List
- **URL**: http://localhost:5173/workspaces
- **Test Items**:
  - [ ] List of all workspaces
  - [ ] Create new workspace button
  - [ ] Workspace cards with details
  - [ ] Switch workspace action
  - [ ] Edit workspace action
  - [ ] Delete workspace action
  - [ ] Workspace member count
  - [ ] Workspace plan badge

#### Create Workspace
- **URL**: http://localhost:5173/workspaces/create
- **Test Items**:
  - [ ] Workspace name input
  - [ ] Workspace description textarea
  - [ ] Workspace slug/URL input
  - [ ] Create button
  - [ ] Cancel button
  - [ ] Form validation

#### Workspace Settings
- **URL**: http://localhost:5173/workspaces/:workspaceId/settings
- **Test Items**:
  - [ ] General settings tab
  - [ ] Workspace name edit
  - [ ] Workspace description edit
  - [ ] Members management section
  - [ ] Invite member button
  - [ ] Member list with roles
  - [ ] Remove member action
  - [ ] Change member role
  - [ ] Danger zone (delete workspace)
  - [ ] Save changes button

---

### 4. Social Accounts Module 🔗

#### Connected Accounts
- **URL**: http://localhost:5173/social/accounts
- **Test Items**:
  - [ ] List of connected social accounts
  - [ ] Connect new account buttons:
    - [ ] Twitter/X button
    - [ ] LinkedIn button
    - [ ] Facebook button
    - [ ] Instagram button
  - [ ] Account cards showing:
    - [ ] Platform icon
    - [ ] Account name/username
    - [ ] Connection status
    - [ ] Last sync time
  - [ ] Disconnect account button
  - [ ] Reconnect account button
  - [ ] Account health status indicator
  - [ ] Token expiry warnings

---

### 5. Posts Module 📝

#### Post List
- **URL**: http://localhost:5173/posts
- **Test Items**:
  - [ ] All posts list view
  - [ ] Filter options:
    - [ ] By status (Draft, Scheduled, Published, Failed)
    - [ ] By platform
    - [ ] By date range
  - [ ] Search posts functionality
  - [ ] Sort options (Date, Status, Platform)
  - [ ] Post cards showing:
    - [ ] Post content preview
    - [ ] Scheduled time
    - [ ] Target platforms
    - [ ] Status badge
    - [ ] Media thumbnails
  - [ ] Create new post button
  - [ ] Edit post action
  - [ ] Delete post action
  - [ ] Duplicate post action
  - [ ] Pagination controls

#### Create Post (Composer)
- **URL**: http://localhost:5173/posts/create
- **Test Items**:
  - [ ] Post composer interface loads
  - [ ] Text editor/textarea for content
  - [ ] Character counter
  - [ ] Platform-specific character limits
  - [ ] Platform selector checkboxes:
    - [ ] Twitter/X
    - [ ] LinkedIn
    - [ ] Facebook
    - [ ] Instagram
  - [ ] Media upload section:
    - [ ] Upload button
    - [ ] Drag & drop area
    - [ ] Image preview
    - [ ] Video preview
    - [ ] Remove media button
    - [ ] Multiple media support
  - [ ] Scheduling options:
    - [ ] Schedule for later radio button
    - [ ] Post now radio button
    - [ ] Date picker
    - [ ] Time picker
    - [ ] Timezone selector
  - [ ] AI Caption Generator:
    - [ ] Generate caption button
    - [ ] AI suggestions
    - [ ] Apply suggestion button
  - [ ] Post preview for each platform
  - [ ] Save as draft button
  - [ ] Schedule post button
  - [ ] Cancel button
  - [ ] Form validation messages

#### Calendar View
- **URL**: http://localhost:5173/posts/calendar
- **Test Items**:
  - [ ] Calendar grid view
  - [ ] Month navigation (prev/next)
  - [ ] Today button
  - [ ] Posts displayed on calendar dates
  - [ ] Color coding by status
  - [ ] Click on date to create post
  - [ ] Click on post to view/edit
  - [ ] Drag & drop to reschedule (if implemented)
  - [ ] Filter by platform
  - [ ] Legend showing status colors
  - [ ] Week/Month view toggle

#### Failed Posts
- **URL**: http://localhost:5173/posts/failed
- **Test Items**:
  - [ ] List of failed posts
  - [ ] Failure reason displayed
  - [ ] Failure timestamp
  - [ ] Retry button for each post
  - [ ] Retry all button
  - [ ] Edit post before retry
  - [ ] Delete failed post
  - [ ] Error details/logs
  - [ ] Filter by platform
  - [ ] Filter by error type

---

### 6. Media Library Module 📷

#### Media Library
- **URL**: http://localhost:5173/media
- **Test Items**:
  - [ ] Grid view of all media
  - [ ] List view option
  - [ ] Upload new media button
  - [ ] Bulk upload support
  - [ ] Media thumbnails
  - [ ] Media details on hover/click:
    - [ ] File name
    - [ ] File size
    - [ ] Upload date
    - [ ] Dimensions (for images)
    - [ ] Duration (for videos)
  - [ ] Search media
  - [ ] Filter by type (Images, Videos, GIFs)
  - [ ] Sort options (Date, Name, Size)
  - [ ] Select multiple media
  - [ ] Delete media action
  - [ ] Download media action
  - [ ] Copy media URL
  - [ ] Use in post button
  - [ ] Pagination or infinite scroll
  - [ ] Storage usage indicator

---

### 7. Analytics Module 📊

#### Analytics Dashboard
- **URL**: http://localhost:5173/analytics
- **Test Items**:
  - [ ] Analytics overview page loads
  - [ ] Date range selector
  - [ ] Key metrics cards:
    - [ ] Total posts published
    - [ ] Total reach/impressions
    - [ ] Total engagement
    - [ ] Engagement rate
  - [ ] Charts and graphs:
    - [ ] Posts over time (line chart)
    - [ ] Engagement by platform (bar chart)
    - [ ] Best posting times (heatmap)
    - [ ] Top performing posts
  - [ ] Platform breakdown
  - [ ] Export data button
  - [ ] Refresh data button
  - [ ] Filter by platform
  - [ ] Filter by date range
  - [ ] Performance comparison

---

### 8. Billing Module 💳

#### Pricing Page
- **URL**: http://localhost:5173/pricing
- **Test Items**:
  - [ ] Pricing plans displayed:
    - [ ] Free plan
    - [ ] Pro plan
    - [ ] Enterprise plan
  - [ ] Plan features list
  - [ ] Monthly/Yearly toggle
  - [ ] Price display
  - [ ] Current plan indicator
  - [ ] Upgrade button
  - [ ] Downgrade button
  - [ ] Contact sales button (Enterprise)
  - [ ] FAQ section
  - [ ] Comparison table

#### Billing Dashboard
- **URL**: http://localhost:5173/billing
- **Test Items**:
  - [ ] Current plan display
  - [ ] Plan features
  - [ ] Usage statistics:
    - [ ] Posts used / limit
    - [ ] Social accounts used / limit
    - [ ] Team members used / limit
  - [ ] Billing cycle information
  - [ ] Next billing date
  - [ ] Payment method section:
    - [ ] Card details (masked)
    - [ ] Update payment method button
  - [ ] Billing history table:
    - [ ] Invoice date
    - [ ] Amount
    - [ ] Status
    - [ ] Download invoice button
  - [ ] Upgrade plan button
  - [ ] Cancel subscription button
  - [ ] Manage subscription link

#### Billing Success
- **URL**: http://localhost:5173/billing/success
- **Test Items**:
  - [ ] Success message
  - [ ] Order confirmation details
  - [ ] Next steps information
  - [ ] Return to dashboard button

#### Billing Cancel
- **URL**: http://localhost:5173/billing/cancel
- **Test Items**:
  - [ ] Cancellation message
  - [ ] Reason for cancellation
  - [ ] Return to billing button
  - [ ] Try again button

---

### 9. Navigation & Layout Components 🧭

#### Sidebar Navigation
- **Test Items**:
  - [ ] Sidebar visible on all pages
  - [ ] Logo/Brand name
  - [ ] Workspace switcher dropdown
  - [ ] Navigation menu items:
    - [ ] Dashboard link
    - [ ] Analytics link
    - [ ] Posts link
    - [ ] Calendar link
    - [ ] Connected Accounts link
    - [ ] Billing link
    - [ ] Workspaces link
  - [ ] Active page highlighting
  - [ ] Collapse/expand sidebar (if implemented)
  - [ ] User profile section at bottom
  - [ ] Logout button

#### Top Navigation Bar
- **Test Items**:
  - [ ] Search bar (if implemented)
  - [ ] Notifications bell icon
  - [ ] Notification dropdown
  - [ ] Notification count badge
  - [ ] User avatar/profile picture
  - [ ] User dropdown menu:
    - [ ] Profile link
    - [ ] Settings link
    - [ ] Help/Support link
    - [ ] Logout link
  - [ ] Theme toggle (Dark/Light mode)

---

### 10. Additional Features & Modals 🎯

#### Upgrade Modal
- **Test Items**:
  - [ ] Modal appears when limit reached
  - [ ] Clear explanation of limit
  - [ ] Current plan vs required plan
  - [ ] Upgrade button
  - [ ] Close modal button
  - [ ] "Don't show again" option

#### Confirmation Dialogs
- **Test Items**:
  - [ ] Delete confirmation modal
  - [ ] Disconnect account confirmation
  - [ ] Cancel subscription confirmation
  - [ ] Clear message
  - [ ] Confirm button
  - [ ] Cancel button

#### Loading States
- **Test Items**:
  - [ ] Loading spinners on data fetch
  - [ ] Skeleton screens
  - [ ] Progress bars for uploads
  - [ ] Disabled buttons during processing

#### Error States
- **Test Items**:
  - [ ] Error messages display correctly
  - [ ] Network error handling
  - [ ] 404 page for invalid routes
  - [ ] 500 error page
  - [ ] Retry buttons on errors
  - [ ] Error boundaries

---

## API Endpoints Testing

### Health Check
```bash
curl http://localhost:5000/api/health
```

### Authentication Endpoints
- POST `/api/auth/register` - User registration
- POST `/api/auth/login` - User login
- POST `/api/auth/logout` - User logout
- POST `/api/auth/refresh` - Refresh token
- GET `/api/auth/me` - Get current user

### Workspace Endpoints
- GET `/api/workspaces` - List workspaces
- POST `/api/workspaces` - Create workspace
- GET `/api/workspaces/:id` - Get workspace
- PUT `/api/workspaces/:id` - Update workspace
- DELETE `/api/workspaces/:id` - Delete workspace

### Social Account Endpoints
- GET `/api/social-accounts` - List connected accounts
- POST `/api/social-accounts/connect` - Connect account
- DELETE `/api/social-accounts/:id` - Disconnect account
- POST `/api/social-accounts/:id/refresh` - Refresh token

### Post Endpoints
- GET `/api/posts` - List posts
- POST `/api/posts` - Create post
- GET `/api/posts/:id` - Get post
- PUT `/api/posts/:id` - Update post
- DELETE `/api/posts/:id` - Delete post
- POST `/api/posts/:id/retry` - Retry failed post

### Media Endpoints
- GET `/api/media` - List media
- POST `/api/media/upload` - Upload media
- DELETE `/api/media/:id` - Delete media

### Analytics Endpoints
- GET `/api/analytics/overview` - Get analytics overview
- GET `/api/analytics/posts` - Get post analytics
- GET `/api/analytics/platforms` - Get platform analytics

### Billing Endpoints
- GET `/api/billing/plans` - List plans
- POST `/api/billing/subscribe` - Subscribe to plan
- POST `/api/billing/cancel` - Cancel subscription
- GET `/api/billing/invoices` - List invoices

---

## Testing Workflow Recommendations

### 1. First Time Setup Flow
1. Register new account
2. Create first workspace
3. Connect social accounts
4. Upload media to library
5. Create first post
6. Schedule post
7. View on calendar
8. Check analytics

### 2. Daily Usage Flow
1. Login
2. Check dashboard
3. View scheduled posts
4. Create new post
5. Check failed posts (if any)
6. Review analytics
7. Manage social accounts

### 3. Admin/Management Flow
1. Access workspace settings
2. Invite team members
3. Manage billing
4. Review usage limits
5. Upgrade/downgrade plan
6. Export data

---

## Known Limitations (Due to Redis Disconnection)

- ⚠️ Post scheduling will not work (posts won't be published automatically)
- ⚠️ Background workers are disabled
- ⚠️ Real-time updates may not work
- ⚠️ Queue-based features are unavailable

To enable full functionality, you need to:
1. Install and start Redis server
2. Update `REDIS_HOST` in `apps/backend/.env` if needed
3. Restart the backend server

---

## Quick Access Links

- **Frontend**: http://localhost:5173/
- **Login**: http://localhost:5173/auth/login
- **Register**: http://localhost:5173/auth/register
- **Dashboard**: http://localhost:5173/
- **Create Post**: http://localhost:5173/posts/create
- **Calendar**: http://localhost:5173/posts/calendar
- **Analytics**: http://localhost:5173/analytics
- **Billing**: http://localhost:5173/billing

---

## Troubleshooting

### Frontend Not Loading
- Check if frontend server is running on port 5173
- Check browser console for errors
- Clear browser cache and reload

### Backend API Errors
- Check if backend server is running on port 5000
- Check MongoDB connection
- Review backend logs in terminal

### Cannot Login/Register
- Check MongoDB is running and connected
- Verify JWT secrets are set in .env
- Check network tab in browser dev tools

---

## Testing Checklist Summary

Use this quick checklist to track your testing progress:

- [ ] Authentication (Login/Register)
- [ ] Dashboard
- [ ] Workspace Management
- [ ] Social Accounts Connection
- [ ] Post Creation (Composer)
- [ ] Post List & Filters
- [ ] Calendar View
- [ ] Failed Posts
- [ ] Media Library
- [ ] Analytics
- [ ] Billing & Pricing
- [ ] Navigation & Sidebar
- [ ] User Profile & Settings
- [ ] Modals & Dialogs
- [ ] Error Handling
- [ ] Responsive Design (Mobile/Tablet)

---

**Happy Testing! 🚀**
