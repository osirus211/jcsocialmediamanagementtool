# Stripe Monetization Layer

## Overview

Implemented complete subscription billing system using Stripe:
- Customer and subscription management
- Webhook-based state synchronization
- Plan enforcement and usage tracking
- Checkout and customer portal

## Architecture

```
User → Checkout → Stripe → Webhook → Billing Model → Plan Enforcement
```

### Production Safety Features

1. **Webhook Idempotency**: Prevents duplicate event processing
   - Uses `WebhookEvent` model to track processed events
   - Skips already-processed events (returns 200 OK)
   - Prevents double subscription activation

2. **Atomic Updates**: MongoDB transactions ensure consistency
   - Billing + Workspace updates are atomic
   - Rollback on partial failure
   - No inconsistent state between models

3. **Safe Plan Mapping**: Prevents wrong plan assignment
   - Returns `null` for unknown Stripe price IDs
   - Logs warning with available price IDs
   - Aborts transaction if price ID unknown

4. **Grace Period**: 7-day grace for payment failures
   - Tracks first payment failure in `metadata.paymentFailedAt`
   - Allows posting for 7 days after first failure
   - Blocks posting after grace period expires
   - Clears timestamp on successful payment

5. **Payment Failure Tracking**: Accurate failure timestamps
   - Records first failure time (not subsequent retries)
   - Used for grace period calculation
   - Cleared on successful payment recovery

---

**File**: `src/services/StripeService.ts`

### Functions

**createCustomer()**:
```typescript
await stripeService.createCustomer({
  email: 'user@example.com',
  name: 'John Doe',
  metadata: { workspaceId: '...' }
});
// Returns: customerId
```

**createCheckoutSession()**:
```typescript
await stripeService.createCheckoutSession(
  customerId,
  priceId,
  workspaceId,
  successUrl,
  cancelUrl
);
// Returns: Checkout URL
```

**createPortalSession()**:
```typescript
await stripeService.createPortalSession(
  customerId,
  returnUrl
);
// Returns: Portal URL
```

**cancelSubscription()**:
```typescript
await stripeService.cancelSubscription(
  subscriptionId,
  true // cancelAtPeriodEnd
);
```

**verifyWebhookSignature()**:
```typescript
const event = stripeService.verifyWebhookSignature(
  rawBody,
  signature
);
// Returns: Stripe.Event
```

### Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:3000
```

## 2. Billing Model

**File**: `src/models/Billing.ts`

### Schema

```typescript
{
  workspaceId: ObjectId (unique),
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  plan: 'free' | 'pro' | 'team' | 'enterprise',
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete',
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: boolean,
  usageSnapshot: {
    postsUsed: number,
    accountsUsed: number,
    aiUsed: number,
    resetAt: Date
  },
  trialEndsAt: Date,
  metadata: object
}
```

### Methods

**isActive()**:
```typescript
billing.isActive()
// Returns: true if status is 'active' or 'trialing'
```

**canPost()**:
```typescript
billing.canPost()
// Returns: true if can create posts (active subscription)
```

**resetUsage()**:
```typescript
billing.resetUsage()
// Resets monthly usage counters
```

## 3. Stripe Webhook Handler

**File**: `src/controllers/StripeWebhookController.ts`

### Production Safety

**Idempotency Check**:
```typescript
// Check if event already processed
const existingEvent = await WebhookEvent.findOne({ stripeEventId: event.id });

if (existingEvent) {
  logger.info('Webhook event already processed (idempotent skip)');
  return res.json({ received: true, alreadyProcessed: true });
}

// Process event...

// Mark as processed
await WebhookEvent.create({
  stripeEventId: event.id,
  eventType: event.type,
  processedAt: new Date(),
});
```

**Atomic Updates**:
```typescript
// Use MongoDB transaction
const session = await Billing.startSession();
session.startTransaction();

try {
  // Update billing
  await billing.save({ session });
  
  // Update workspace
  await Workspace.findByIdAndUpdate(workspaceId, { plan }, { session });
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

**Safe Plan Mapping**:
```typescript
private getPlanFromPriceId(priceId?: string): BillingPlan | null {
  if (!priceId) return null;
  
  const plan = priceMap[priceId];
  
  if (!plan) {
    logger.warn('Unknown Stripe price ID', { priceId });
    return null; // Prevents wrong plan assignment
  }
  
  return plan;
}
```

### Handled Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate subscription |
| `customer.subscription.created` | Create subscription |
| `customer.subscription.updated` | Sync subscription changes |
| `customer.subscription.deleted` | Downgrade to free plan |
| `invoice.payment_failed` | Mark as past_due |
| `invoice.payment_succeeded` | Reactivate if was past_due |

### Webhook Flow

```
1. Stripe sends webhook → POST /api/billing/webhook
2. Verify signature using STRIPE_WEBHOOK_SECRET
3. Process event based on type
4. Update Billing model
5. Update Workspace.plan
6. Return 200 OK
```

### Example: Checkout Completed

```typescript
// Event: checkout.session.completed
{
  id: 'evt_...',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_...',
      subscription: 'sub_...',
      metadata: {
        workspaceId: '507f1f77bcf86cd799439011'
      }
    }
  }
}

// Action:
1. Get subscription from Stripe
2. Update Billing:
   - stripeSubscriptionId = 'sub_...'
   - plan = 'pro' (from price ID)
   - status = 'active'
   - currentPeriodEnd = subscription.current_period_end
3. Update Workspace.plan = 'pro'
4. Reset usage counters
```

### Example: Payment Failed

```typescript
// Event: invoice.payment_failed
{
  type: 'invoice.payment_failed',
  data: {
    object: {
      subscription: 'sub_...'
    }
  }
}

// Action:
1. Find Billing by stripeSubscriptionId
2. Update status = 'past_due'
3. Track first failure: metadata.paymentFailedAt = new Date()
4. User enters 7-day grace period
5. After 7 days: posting blocked
```

### Example: Payment Recovered

```typescript
// Event: invoice.payment_succeeded
{
  type: 'invoice.payment_succeeded',
  data: {
    object: {
      subscription: 'sub_...'
    }
  }
}

// Action:
1. Find Billing by stripeSubscriptionId
2. If status was 'past_due':
   - Update status = 'active'
   - Clear metadata.paymentFailedAt
   - User can post again
```

## 4. Plan Enforcement

**File**: `src/services/PlanEnforcementService.ts`

### Plan Limits

```typescript
const PLAN_LIMITS = {
  free: {
    maxPosts: 10,        // per month
    maxAccounts: 2,
    maxAIRequests: 5,    // per month
    features: {
      scheduling: true,
      analytics: false,
      aiAssistant: true,
      multipleAccounts: true,
      teamMembers: false,
    }
  },
  pro: {
    maxPosts: 100,
    maxAccounts: 10,
    maxAIRequests: 100,
    features: {
      scheduling: true,
      analytics: true,
      aiAssistant: true,
      multipleAccounts: true,
      teamMembers: false,
    }
  },
  team: {
    maxPosts: 500,
    maxAccounts: 50,
    maxAIRequests: 500,
    features: {
      scheduling: true,
      analytics: true,
      aiAssistant: true,
      multipleAccounts: true,
      teamMembers: true,
    }
  },
  enterprise: {
    maxPosts: -1,        // unlimited
    maxAccounts: -1,     // unlimited
    maxAIRequests: -1,   // unlimited
    features: { all: true }
  }
};
```

### Enforcement Functions

**canCreatePost()**:
```typescript
const result = await planEnforcementService.canCreatePost(workspaceId);

if (!result.allowed) {
  throw new Error(result.reason);
  // "Monthly post limit reached (10). Upgrade to post more."
  // "Payment failed - please update payment method to continue posting"
  // (after 7-day grace period)
}

// Grace period logic:
// - Payment fails → status = 'past_due'
// - Days 0-7: Posting allowed (grace period)
// - Day 7+: Posting blocked until payment succeeds
```

**canConnectAccount()**:
```typescript
const result = await planEnforcementService.canConnectAccount(workspaceId);

if (!result.allowed) {
  throw new Error(result.reason);
  // "Account limit reached (2). Upgrade to connect more accounts."
}
```

**canUseAI()**:
```typescript
const result = await planEnforcementService.canUseAI(workspaceId);

if (!result.allowed) {
  throw new Error(result.reason);
  // "Monthly AI request limit reached (5). Upgrade for more."
}
```

**incrementPostUsage()**:
```typescript
await planEnforcementService.incrementPostUsage(workspaceId);
// Increments usageSnapshot.postsUsed
```

**incrementAIUsage()**:
```typescript
await planEnforcementService.incrementAIUsage(workspaceId);
// Increments usageSnapshot.aiUsed
```

## 5. Checkout Flow

**Endpoint**: `POST /api/billing/checkout`

**Request**:
```json
{
  "priceId": "price_pro_monthly"
}
```

**Response**:
```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_..."
}
```

**Flow**:
```
1. User clicks "Upgrade to Pro"
2. Frontend calls POST /api/billing/checkout { priceId }
3. Backend:
   - Gets/creates Billing record
   - Creates Stripe customer if needed
   - Creates checkout session with workspaceId in metadata
4. Returns checkout URL
5. User redirected to Stripe Checkout
6. User completes payment
7. Stripe sends checkout.session.completed webhook
8. Backend activates subscription
9. User redirected to success URL
```

## 6. Customer Portal

**Endpoint**: `POST /api/billing/portal`

**Response**:
```json
{
  "url": "https://billing.stripe.com/p/session/..."
}
```

**Flow**:
```
1. User clicks "Manage Subscription"
2. Frontend calls POST /api/billing/portal
3. Backend creates portal session
4. Returns portal URL
5. User redirected to Stripe Customer Portal
6. User can:
   - Update payment method
   - Cancel subscription
   - View invoices
   - Update billing info
7. Changes synced via webhooks
```

## Integration Points

### Post Creation

**Before**:
```typescript
// In PostController.createPost()
const post = await Post.create({ ... });
```

**After**:
```typescript
// In PostController.createPost()

// Check plan limits
const canPost = await planEnforcementService.canCreatePost(workspaceId);
if (!canPost.allowed) {
  return res.status(403).json({ error: canPost.reason });
}

// Create post
const post = await Post.create({ ... });

// Increment usage
await planEnforcementService.incrementPostUsage(workspaceId);
```

### Account Connection

**Before**:
```typescript
// In SocialAccountController.connect()
const account = await SocialAccount.create({ ... });
```

**After**:
```typescript
// In SocialAccountController.connect()

// Check plan limits
const canConnect = await planEnforcementService.canConnectAccount(workspaceId);
if (!canConnect.allowed) {
  return res.status(403).json({ error: canConnect.reason });
}

// Connect account
const account = await SocialAccount.create({ ... });
```

### AI Features

**Before**:
```typescript
// In AIController.generate()
const result = await aiService.generate(prompt);
```

**After**:
```typescript
// In AIController.generate()

// Check plan limits
const canUseAI = await planEnforcementService.canUseAI(workspaceId);
if (!canUseAI.allowed) {
  return res.status(403).json({ error: canUseAI.reason });
}

// Generate AI content
const result = await aiService.generate(prompt);

// Increment usage
await planEnforcementService.incrementAIUsage(workspaceId);
```

## Subscription Lifecycle

### 1. New User (Free Plan)

```
1. User signs up
2. Workspace created with plan='free'
3. Billing record created:
   - plan = 'free'
   - status = 'active'
   - No stripeSubscriptionId
4. User can create 10 posts/month
```

### 2. Upgrade to Pro

```
1. User clicks "Upgrade to Pro"
2. Checkout flow initiated
3. User completes payment
4. Webhook: checkout.session.completed
5. Billing updated:
   - plan = 'pro'
   - status = 'active'
   - stripeSubscriptionId = 'sub_...'
   - currentPeriodEnd = 30 days from now
6. Usage reset
7. User can create 100 posts/month
```

### 3. Payment Failed

```
1. Stripe attempts to charge card
2. Payment fails
3. Webhook: invoice.payment_failed
4. Billing updated:
   - status = 'past_due'
   - metadata.paymentFailedAt = now
5. Grace period starts (7 days)
6. Days 0-7: User can still create posts
7. Day 7+: Posting blocked
8. User sees: "Payment failed - please update payment method to continue posting"
9. User updates card in Customer Portal
10. Payment succeeds
11. Webhook: invoice.payment_succeeded
12. Billing updated:
    - status = 'active'
    - metadata.paymentFailedAt cleared
13. User can create posts again (no restrictions)
```

### 4. Cancellation

```
1. User clicks "Cancel Subscription" in portal
2. Webhook: customer.subscription.updated
3. Billing updated:
   - cancelAtPeriodEnd = true
4. User can still use paid features until period end
5. At period end:
6. Webhook: customer.subscription.deleted
7. Billing updated:
   - plan = 'free'
   - status = 'canceled'
   - stripeSubscriptionId = null
8. User downgraded to free limits
```

## Testing

### Test Checkout (Stripe Test Mode)

```bash
# Use test card
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits
```

### Test Webhooks Locally

```bash
# Install Stripe CLI
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:5000/api/billing/webhook

# Get webhook secret
# Copy to .env as STRIPE_WEBHOOK_SECRET

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

### Test Plan Limits

```typescript
// Create test workspace with free plan
const workspace = await Workspace.create({ plan: 'free' });
const billing = await Billing.create({
  workspaceId: workspace._id,
  stripeCustomerId: 'cus_test',
  plan: 'free',
  status: 'active',
});

// Try to create 11th post (should fail)
for (let i = 0; i < 11; i++) {
  const canPost = await planEnforcementService.canCreatePost(workspace._id);
  console.log(`Post ${i + 1}: ${canPost.allowed ? 'OK' : canPost.reason}`);
  
  if (canPost.allowed) {
    await planEnforcementService.incrementPostUsage(workspace._id);
  }
}
```

## Monitoring

### Key Metrics

- Subscription activations (checkout.session.completed)
- Payment failures (invoice.payment_failed)
- Cancellations (customer.subscription.deleted)
- Plan limit hits (403 errors)
- Usage by plan

### Log Queries

```bash
# Subscription activations
grep "Subscription activated" logs

# Payment failures
grep "past_due" logs

# Plan limit hits
grep "limit reached" logs

# Webhook processing
grep "Stripe webhook received" logs
```

## Security

1. **Webhook signature verification**: All webhooks verified using STRIPE_WEBHOOK_SECRET
2. **Customer ID validation**: Ensure customer belongs to workspace
3. **Metadata validation**: workspaceId in all subscription metadata
4. **Raw body required**: Webhook endpoint uses raw body (not JSON parsed)
5. **HTTPS only**: Stripe requires HTTPS for webhooks in production

## Common Issues

### Issue 1: Webhook Signature Verification Failed
**Cause**: Wrong STRIPE_WEBHOOK_SECRET or body parsed as JSON
**Solution**: Use raw body parser for webhook endpoint

### Issue 2: Subscription Not Activating
**Cause**: Missing workspaceId in metadata
**Solution**: Ensure metadata passed to createCheckoutSession

### Issue 3: Usage Not Resetting
**Cause**: Monthly reset job not running
**Solution**: Set up cron job to call resetMonthlyUsage()

### Issue 4: Duplicate Webhook Processing
**Cause**: Webhook retries or network issues
**Solution**: ✅ Handled by WebhookEvent idempotency check

### Issue 5: Inconsistent Billing State
**Cause**: Partial DB write failure (billing updated, workspace not)
**Solution**: ✅ Handled by MongoDB transaction (atomic updates)

### Issue 6: Wrong Plan Assigned
**Cause**: Unknown Stripe price ID
**Solution**: ✅ Handled by safe plan mapping (returns null, aborts transaction)

### Issue 7: Users Blocked Immediately on Payment Failure
**Cause**: No grace period
**Solution**: ✅ Handled by 7-day grace period in canCreatePost()

## Price ID Mapping

Update `StripeWebhookController.getPlanFromPriceId()` with your actual Stripe price IDs:

```typescript
const priceMap: Record<string, BillingPlan> = {
  // Replace with your actual Stripe price IDs
  'price_1ABC123': BillingPlan.PRO,
  'price_2DEF456': BillingPlan.TEAM,
  'price_3GHI789': BillingPlan.ENTERPRISE,
};
```

## Cron Jobs

### Monthly Usage Reset

```typescript
// Run on 1st of every month
import { planEnforcementService } from './services/PlanEnforcementService';

cron.schedule('0 0 1 * *', async () => {
  await planEnforcementService.resetMonthlyUsage();
});
```

## Next Steps

1. ✅ Stripe integration - Complete
2. ✅ Billing model - Complete
3. ✅ Webhook handler - Complete
4. ✅ Plan enforcement - Complete
5. ⏳ Frontend checkout UI - TODO
6. ⏳ Usage dashboard - TODO
7. ⏳ Email notifications (payment failed) - TODO
8. ⏳ Analytics tracking - TODO
