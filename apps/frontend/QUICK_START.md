# Quick Start Guide

## Setup

1. **Install dependencies**:
```bash
cd apps/frontend
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_API_URL=http://localhost:5000/api
```

3. **Start development server**:
```bash
npm run dev
```

---

## Usage

### 1. View Dashboard
```
Navigate to: /billing/dashboard
Shows: Plan, usage, billing status
```

### 2. Upgrade Plan
```
Click: "Upgrade Plan" button
Redirects to: Stripe Checkout
After payment: Returns to dashboard
```

### 3. Manage Billing
```
Click: "Manage Billing" button
Redirects to: Stripe Customer Portal
Can: Update payment, cancel, view invoices
```

### 4. Connect Social Account
```
Navigate to: /social/accounts
Click: "Connect" button for platform
Redirects to: OAuth provider
After auth: Returns to accounts page
```

### 5. Create Post
```
Navigate to: /posts/create
Select: Platforms
Enter: Content
Optional: Schedule date/time
Optional: Enable thread mode
Optional: Generate AI content
Click: "Post Now" or "Schedule Post"
```

---

## API Integration

All services use the centralized `apiClient`:

```typescript
import { billingService } from '@/services/billing.service';
import { socialService } from '@/services/social.service';
import { postService } from '@/services/post.service';

// Get usage
const usage = await billingService.getCurrentUsage();

// Connect account
const { url } = await socialService.getOAuthUrl('twitter');

// Create post
const post = await postService.createPost({
  content: 'Hello world!',
  platforms: ['twitter', 'linkedin'],
});
```

---

## Error Handling

### Plan Limit Reached
```typescript
try {
  await postService.createPost(data);
} catch (err) {
  if (err.response?.status === 403) {
    // Show upgrade modal
    alert(err.response.data.error);
  }
}
```

### Payment Failed
```typescript
if (billing.status === 'past_due') {
  // Show alert banner
  // Redirect to billing portal
}
```

---

## Components

### BillingDashboard
```typescript
import { BillingDashboard } from '@/pages/billing/BillingDashboard';

<BillingDashboard />
```

### SocialAccounts
```typescript
import { SocialAccounts } from '@/pages/social/SocialAccounts';

<SocialAccounts />
```

### PostComposer
```typescript
import { PostComposer } from '@/pages/posts/PostComposer';

<PostComposer />
```

---

## Routing

Add to your router:

```typescript
import { BillingDashboard } from '@/pages/billing/BillingDashboard';
import { SocialAccounts } from '@/pages/social/SocialAccounts';
import { PostComposer } from '@/pages/posts/PostComposer';

const routes = [
  { path: '/billing/dashboard', element: <BillingDashboard /> },
  { path: '/social/accounts', element: <SocialAccounts /> },
  { path: '/posts/create', element: <PostComposer /> },
];
```

---

## Testing

### Run tests
```bash
npm test
```

### Test coverage
```bash
npm run test:coverage
```

### E2E tests
```bash
npm run test:e2e
```

---

## Build

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm run preview
```

---

## Troubleshooting

### API not connecting
- Check `VITE_API_URL` in `.env`
- Ensure backend is running
- Check CORS settings

### OAuth not working
- Verify redirect URLs in OAuth app settings
- Check callback route is configured
- Ensure HTTPS in production

### Stripe not loading
- Verify Stripe keys in backend
- Check webhook endpoint is accessible
- Test with Stripe CLI locally

---

## Documentation

- **FRONTEND_IMPLEMENTATION.md** - Complete technical docs
- **UI_FLOWS.md** - Visual flow diagrams
- **IMPLEMENTATION_SUMMARY.md** - Feature summary
- **QUICK_START.md** - This file

---

## Support

For issues or questions:
1. Check documentation
2. Review error logs
3. Test API endpoints
4. Verify environment variables

---

## Quick Commands

```bash
# Install
npm install

# Dev
npm run dev

# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Format
npm run format
```

---

Ready to go! 🚀
