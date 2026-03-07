# Phase 9: Billing & Subscription - Quick Reference

## Plan Tiers

| Plan | Price/Month | Price/Year | Channels | Posts | Members | Storage |
|------|-------------|------------|----------|-------|---------|---------|
| Free | $0 | $0 | 3 | 100 | 1 | 1GB |
| Pro | $29 | $290 | 10 | 500 | 5 | 10GB |
| Agency | $99 | $990 | 50 | 2000 | 25 | 50GB |

## Common Operations

### Check Limits Before Operations

```typescript
// Before creating a post
const { allowed, reason } = await limitEnforcementService.canCreatePost(workspaceId);
if (!allowed) throw new Error(reason);

// Before connecting a channel
const { allowed } = await limitEnforcementService.canConnectChannel(workspaceId);

// Before inviting a member
const { allowed } = await limitEnforcementService.canInviteMember(workspaceId);

// Before uploading media
const { allowed } = await limitEnforcementService.canUploadMedia(workspaceId, sizeInMB);
```

### Track Usage

```typescript
// Track post creation
await usageService.incrementPostsScheduled(workspaceId);

// Track post publishing
await usageService.incrementPostsPublished(workspaceId);

// Track media upload
await usageService.incrementMediaUploads(workspaceId, sizeInMB);

// Track analytics access
await usageService.incrementAnalyticsRequests(workspaceId);

// Update team size
await usageService.updateTeamMembers(workspaceId, count);

// Update channels
await usageService.updateChannelsConnected(workspaceId, count);
```

### Check Feature Access

```typescript
// Check single feature
const hasAccess = await featureGatingService.hasAccess(
  workspaceId,
  Feature.ADVANCED_ANALYTICS
);

// Require feature (throws if not available)
await featureGatingService.requireFeature(
  workspaceId,
  Feature.API_ACCESS
);

// Check multiple features
const access = await featureGatingService.hasAccessToFeatures(
  workspaceId,
  [Feature.TEAM_COLLABORATION, Feature.APPROVAL_WORKFLOW]
);
```

### Subscription Management

```typescript
// Create subscription
const subscription = await stripeService.createSubscription({
  workspaceId,
  planId,
  billingCycle: BillingCycle.MONTHLY,
  paymentMethodId: 'pm_xxx',
  email: 'user@example.com',
  name: 'John Doe',
  trialDays: 14, // optional
});

// Cancel subscription (at period end)
await stripeService.cancelSubscription({
  workspaceId,
  immediately: false,
});

// Cancel immediately
await stripeService.cancelSubscription({
  workspaceId,
  immediately: true,
});

// Reactivate canceled subscription
await stripeService.reactivateSubscription(workspaceId);

// Update plan
await stripeService.updateSubscriptionPlan({
  workspaceId,
  newPlanId,
  billingCycle: BillingCycle.YEARLY,
});
```

## Features by Plan

### Free Plan
- Up to 3 social channels
- 100 posts per month
- Basic analytics
- Post scheduling

### Pro Plan
- Up to 10 social channels
- 500 posts per month
- Advanced analytics
- Team collaboration
- Approval workflow
- Priority support

### Agency Plan
- Up to 50 social channels
- 2000 posts per month
- Advanced analytics
- Unlimited team members
- Approval workflow
- API access
- White-label options
- Dedicated support

## Feature Enum

```typescript
enum Feature {
  // Analytics
  BASIC_ANALYTICS = 'Basic analytics',
  ADVANCED_ANALYTICS = 'Advanced analytics',
  EXPORT_ANALYTICS = 'Export analytics',
  
  // Collaboration
  TEAM_COLLABORATION = 'Team collaboration',
  APPROVAL_WORKFLOW = 'Approval workflow',
  
  // Integration
  API_ACCESS = 'API access',
  WEBHOOK_INTEGRATION = 'Webhook integration',
  
  // Support
  PRIORITY_SUPPORT = 'Priority support',
  DEDICATED_SUPPORT = 'Dedicated support',
  
  // Advanced
  WHITE_LABEL = 'White-label options',
  CUSTOM_BRANDING = 'Custom branding',
  BULK_SCHEDULING = 'Bulk scheduling',
  CONTENT_CALENDAR = 'Content calendar',
}
```

## Webhook Events

Handle these Stripe webhook events:

```typescript
// In webhook endpoint
const event = stripeService.constructWebhookEvent(payload, signature);
await stripeService.handleWebhook(event);
```

**Handled Events**:
- `invoice.paid` - Payment successful
- `invoice.payment_failed` - Payment failed
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Subscription canceled
- `customer.subscription.trial_will_end` - Trial ending soon

## Metrics

All billing metrics are automatically recorded:

```typescript
// Subscription metrics
recordSubscriptionCreated(plan, billingCycle);
recordSubscriptionCanceled(plan, immediately);

// Payment metrics
recordPaymentSucceeded(plan, amount);
recordPaymentFailed(plan, amount);

// Usage metrics
recordUsageLimitReached(workspaceId, limitType, plan);
updateUsagePercentage(workspaceId, limitType, plan, percentage);

// Conversion metrics
recordTrialConversion(plan);
recordPlanUpgrade(fromPlan, toPlan);
```

## Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

## Error Handling

```typescript
try {
  await stripeService.createSubscription(params);
} catch (error) {
  if (error.message.includes('Stripe')) {
    // Handle Stripe-specific errors
    logger.error('Stripe error:', error);
  }
  throw new Error('Failed to create subscription');
}
```

## Usage Summary

```typescript
// Get comprehensive usage data
const summary = await usageService.getUsageSummary(workspaceId);

// Returns:
{
  current: IUsage,           // Current month usage
  plan: IPlan,               // Current plan
  limits: {                  // Limit status
    postsPerMonth: { current, limit, exceeded },
    channels: { current, limit, exceeded },
    teamMembers: { current, limit, exceeded },
    mediaStorage: { current, limit, exceeded },
  },
  percentages: {             // Usage percentages
    posts: 45.2,
    channels: 30.0,
    teamMembers: 60.0,
    mediaStorage: 12.5,
  }
}
```

## Integration Checklist

- [ ] Add limit checks before operations
- [ ] Track usage after operations
- [ ] Check feature access for protected features
- [ ] Set up Stripe webhook endpoint
- [ ] Configure environment variables
- [ ] Add billing UI components
- [ ] Implement upgrade/downgrade flows
- [ ] Set up usage limit notifications
- [ ] Add payment failure handling
- [ ] Configure monitoring and alerts
