# UI Flows - Visual Guide

## 1. Dashboard Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Billing & Usage Dashboard                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 💳 Current Plan                                        │ │
│  │ Pro                    [Active]                        │ │
│  │ Renews on Jan 31, 2024                                 │ │
│  │                    [Upgrade Plan] [Manage Billing]    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 📊 Posts │  │ 👥 Accts │  │ ⚡ AI   │  │ 💾 Store │   │
│  │ 45 / 100 │  │ 5 / 10   │  │ 23 / 100│  │ 234 / 1GB│   │
│  │ ████░░░░ │  │ ████░░░░ │  │ ██░░░░░░│  │ ██░░░░░░ │   │
│  │ 45% used │  │ 50% used │  │ 23% used│  │ 23% used │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  Billing Period: Jan 1 - Jan 31, 2024                       │
│  Usage resets at the end of each billing period             │
└─────────────────────────────────────────────────────────────┘
```

## 2. Upgrade Flow

```
User clicks "Upgrade Plan"
         ↓
┌─────────────────────────────────────┐
│ Select Plan                         │
│ ○ Pro - $29/month                   │
│ ○ Team - $99/month                  │
│ ○ Enterprise - Contact us           │
│                                     │
│ [Continue to Payment →]             │
└─────────────────────────────────────┘
         ↓
Redirect to Stripe Checkout
         ↓
┌─────────────────────────────────────┐
│ Stripe Checkout                     │
│ ┌─────────────────────────────────┐ │
│ │ Card Number                     │ │
│ │ [4242 4242 4242 4242]          │ │
│ │                                 │ │
│ │ Expiry        CVC               │ │
│ │ [12/25]      [123]             │ │
│ │                                 │ │
│ │ [Pay $29.00]                   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
         ↓
Payment Success
         ↓
┌─────────────────────────────────────┐
│ ✅ Subscription Activated           │
│ Welcome to Pro!                     │
│ [Go to Dashboard]                   │
└─────────────────────────────────────┘
```

## 3. Social Connect Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Social Accounts                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🐦 Twitter                                             │ │
│  │ Not connected                                          │ │
│  │                                    [Connect]           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 💼 LinkedIn                                            │ │
│  │ @johndoe                                               │ │
│  │ Connected Jan 15, 2024                                 │ │
│  │                                    [Disconnect]        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📘 Facebook                                            │ │
│  │ Not connected                                          │ │
│  │                                    [Connect]           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📷 Instagram                                           │ │
│  │ Not connected                                          │ │
│  │                                    [Connect]           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

User clicks "Connect Twitter"
         ↓
Redirect to Twitter OAuth
         ↓
┌─────────────────────────────────────┐
│ Authorize App                       │
│ SocialScheduler wants to:           │
│ • Read your profile                 │
│ • Post tweets                       │
│ • Access your timeline              │
│                                     │
│ [Cancel]  [Authorize App]          │
└─────────────────────────────────────┘
         ↓
Redirect back to app
         ↓
┌─────────────────────────────────────┐
│ ✅ Twitter Connected                │
│ @johndoe                            │
│ [Go to Dashboard]                   │
└─────────────────────────────────────┘
```

## 4. Post Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Create Post                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Select Platforms                                            │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐                            │
│  │ 🐦 │  │ 💼 │  │ 📘 │  │ 📷 │                            │
│  │ ✓  │  │ ✓  │  │    │  │    │                            │
│  └────┘  └────┘  └────┘  └────┘                            │
│                                                              │
│  ☑ Create Twitter Thread                                    │
│                                                              │
│  Post Content                          [✨ AI Generate]     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ What's on your mind?                                   │ │
│  │                                                        │ │
│  │                                                        │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  0 characters                                                │
│                                                              │
│  Schedule (Optional)                                         │
│  📅 [2024-01-15 10:00 AM]                                   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              [📤 Post Now]                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

User clicks "Post Now"
         ↓
┌─────────────────────────────────────┐
│ ✅ Post Created Successfully        │
│ Your post has been scheduled        │
│ [View Posts]                        │
└─────────────────────────────────────┘
```

## 5. Plan Limit Reached Flow

```
User tries to create post
         ↓
POST /api/posts → 403 Forbidden
         ↓
┌─────────────────────────────────────┐
│ ⚠️  Post Limit Reached              │
│                                     │
│ You've used 10/10 posts this month. │
│                                     │
│ Upgrade to Pro for:                 │
│ • 100 posts per month               │
│ • 10 social accounts                │
│ • 100 AI requests                   │
│ • 1 GB storage                      │
│                                     │
│ [Cancel]  [Upgrade to Pro →]       │
└─────────────────────────────────────┘
         ↓
User clicks "Upgrade to Pro"
         ↓
Redirect to Stripe Checkout
```

## 6. Past Due Billing Flow

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️  Payment Failed                                          │
│ Your payment method was declined. Please update it to       │
│ continue using paid features.                               │
│ Grace period: 5 days remaining                              │
│ [Update Payment Method]                                     │
└─────────────────────────────────────────────────────────────┘
         ↓
User clicks "Update Payment Method"
         ↓
Redirect to Stripe Portal
         ↓
┌─────────────────────────────────────┐
│ Stripe Customer Portal              │
│ ┌─────────────────────────────────┐ │
│ │ Payment Methods                 │ │
│ │ Visa •••• 4242 (Expired)       │ │
│ │ [Update]                       │ │
│ │                                 │ │
│ │ [+ Add Payment Method]         │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
         ↓
User updates payment method
         ↓
Webhook updates subscription
         ↓
┌─────────────────────────────────────┐
│ ✅ Payment Method Updated           │
│ Your subscription is now active     │
│ [Go to Dashboard]                   │
└─────────────────────────────────────┘
```

## 7. Usage Near Limit Flow

```
┌─────────────────────────────────────┐
│ 📊 Posts                            │
│ 8 / 10                              │
│ ████████░░ 80%                      │
│ ⚠️  Approaching limit               │
│                                     │
│ You've used 80% of your monthly     │
│ post limit. Upgrade to avoid        │
│ interruptions.                      │
│                                     │
│ [Upgrade for more →]                │
└─────────────────────────────────────┘
```

## 8. No Connected Accounts Flow

```
User tries to create post
         ↓
┌─────────────────────────────────────┐
│ ℹ️  No Social Accounts Connected    │
│                                     │
│ Connect at least one social account │
│ to start posting.                   │
│                                     │
│ [Connect Accounts →]                │
└─────────────────────────────────────┘
         ↓
Redirect to Social Accounts page
```

## 9. AI Generate Flow

```
User enters prompt: "Write a tweet about productivity"
         ↓
User clicks "AI Generate"
         ↓
┌─────────────────────────────────────┐
│ Post Content    [✨ Generating...]  │
│ ┌─────────────────────────────────┐ │
│ │ Write a tweet about productivity│ │
│ │                                 │ │
│ │ [Loading spinner]               │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
         ↓
POST /api/ai/generate
         ↓
┌─────────────────────────────────────┐
│ Post Content      [✨ AI Generate]  │
│ ┌─────────────────────────────────┐ │
│ │ 🚀 Boost your productivity with │ │
│ │ these 5 simple tips:            │ │
│ │ 1. Start your day with a plan  │ │
│ │ 2. Take regular breaks          │ │
│ │ 3. Eliminate distractions       │ │
│ │ ...                             │ │
│ └─────────────────────────────────┘ │
│ 280 characters                      │
└─────────────────────────────────────┘
```

## 10. Thread Creation Flow

```
User enables "Create Twitter Thread"
         ↓
┌─────────────────────────────────────┐
│ Thread Content    [✨ AI Generate]  │
│                                     │
│ Tweet 1                             │
│ ┌─────────────────────────────────┐ │
│ │ First tweet in thread...        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Tweet 2                        [×]  │
│ ┌─────────────────────────────────┐ │
│ │ Second tweet...                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Tweet 3                        [×]  │
│ ┌─────────────────────────────────┐ │
│ │ Third tweet...                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │        [+ Add Tweet]            │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 11. Responsive Design

### Desktop (1920px)
```
┌────────────────────────────────────────────────────────────┐
│ [Logo]  Dashboard  Posts  Accounts  Billing     [Profile] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Posts   │  │ Accounts │  │    AI    │  │ Storage  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Tablet (768px)
```
┌──────────────────────────────────────┐
│ [☰]  Dashboard           [Profile]  │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────┐  ┌──────────┐        │
│  │  Posts   │  │ Accounts │        │
│  └──────────┘  └──────────┘        │
│                                      │
│  ┌──────────┐  ┌──────────┐        │
│  │    AI    │  │ Storage  │        │
│  └──────────┘  └──────────┘        │
│                                      │
└──────────────────────────────────────┘
```

### Mobile (375px)
```
┌────────────────────────┐
│ [☰]  Dashboard  [👤]  │
├────────────────────────┤
│                        │
│  ┌──────────────────┐ │
│  │      Posts       │ │
│  └──────────────────┘ │
│                        │
│  ┌──────────────────┐ │
│  │    Accounts      │ │
│  └──────────────────┘ │
│                        │
│  ┌──────────────────┐ │
│  │       AI         │ │
│  └──────────────────┘ │
│                        │
│  ┌──────────────────┐ │
│  │     Storage      │ │
│  └──────────────────┘ │
│                        │
└────────────────────────┘
```

---

## Summary

All UI flows are designed to be:
- Intuitive and user-friendly
- Responsive across devices
- Clear error messaging
- Smooth transitions
- Accessible (WCAG compliant)
- Fast loading states
- Graceful degradation

The flows handle all edge cases:
- Plan limits
- Payment failures
- No connected accounts
- Network errors
- Loading states
- Success confirmations
