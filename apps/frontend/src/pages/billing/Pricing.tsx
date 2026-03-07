/**
 * Pricing Page
 * Premium SaaS pricing page with plan cards and features
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBillingStore } from '../../store/billing.store';
import { useWorkspaceStore } from '../../store/workspace.store';
import { Plan, BillingPeriod } from '../../types/billing.types';
import { Check } from 'lucide-react';

export default function Pricing() {
  const navigate = useNavigate();
  const { plans, currentSubscription, fetchPlans, fetchSubscription, createCheckout, isLoading } =
    useBillingStore();
  const { currentWorkspace } = useWorkspaceStore();

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
    if (currentWorkspace) {
      fetchSubscription();
    }
  }, [currentWorkspace]);

  const handleSubscribe = async (plan: Plan) => {
    if (!currentWorkspace) {
      navigate('/workspaces');
      return;
    }

    // If already on this plan, go to billing page
    if (currentSubscription?.plan.name === plan.name) {
      navigate('/billing');
      return;
    }

    // If free plan, just navigate to billing
    if (plan.name === 'free') {
      navigate('/billing');
      return;
    }

    try {
      setSubscribingTo(plan.name);

      // Create checkout session and redirect to Stripe
      const checkoutUrl = await createCheckout(plan.name, billingPeriod);
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Checkout error:', error);
      setSubscribingTo(null);
    }
  };

  const getPrice = (plan: Plan) => {
    return billingPeriod === 'monthly' ? plan.priceMonthly : plan.priceYearly;
  };

  const getPriceLabel = (plan: Plan) => {
    if (plan.priceMonthly === 0) return 'Free';

    const price = getPrice(plan);
    const period = billingPeriod === 'monthly' ? 'mo' : 'yr';

    return `$${price}/${period}`;
  };

  const getButtonText = (plan: Plan) => {
    if (currentSubscription?.plan.name === plan.name) {
      return 'Current Plan';
    }

    if (plan.name === 'free') {
      return 'Get Started';
    }

    if (!currentSubscription || currentSubscription.plan.name === 'free') {
      return 'Subscribe';
    }

    // Compare plan tiers
    const planOrder = ['free', 'pro', 'team', 'enterprise'];
    const currentIndex = planOrder.indexOf(currentSubscription.plan.name);
    const targetIndex = planOrder.indexOf(plan.name);

    if (targetIndex > currentIndex) {
      return 'Upgrade';
    } else {
      return 'Downgrade';
    }
  };

  const isCurrentPlan = (plan: Plan) => {
    return currentSubscription?.plan.name === plan.name;
  };

  const getYearlySavings = (plan: Plan) => {
    if (plan.priceMonthly === 0) return 0;
    const monthlyTotal = plan.priceMonthly * 12;
    const savings = monthlyTotal - plan.priceYearly;
    return Math.round((savings / monthlyTotal) * 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            Scale your social media presence with the right plan for your needs
          </p>

          {/* Billing Period Toggle */}
          <div className="inline-flex items-center bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Yearly
              {plans.length > 0 && getYearlySavings(plans[1]) > 0 && (
                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  Save {getYearlySavings(plans[1])}%
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => (
            <div
              key={plan._id}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden transition-transform hover:scale-105 ${
                plan.name === 'pro' ? 'ring-2 ring-blue-600' : ''
              }`}
            >
              {/* Popular Badge */}
              {plan.name === 'pro' && (
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  POPULAR
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentPlan(plan) && (
                <div className="absolute top-0 left-0 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-br-lg">
                  CURRENT
                </div>
              )}

              <div className="p-8">
                {/* Plan Name */}
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {plan.displayName}
                </h3>

                {/* Description */}
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    {getPriceLabel(plan)}
                  </span>
                  {plan.priceMonthly > 0 && (
                    <span className="text-gray-600 dark:text-gray-400 text-sm ml-2">
                      per {billingPeriod === 'monthly' ? 'month' : 'year'}
                    </span>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={isCurrentPlan(plan) || subscribingTo === plan.name || isLoading}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    isCurrentPlan(plan)
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : plan.name === 'pro'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {subscribingTo === plan.name ? 'Loading...' : getButtonText(plan)}
                </button>

                {/* Features */}
                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Limits */}
                <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                    Plan Limits
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li>
                      {plan.limits.maxSocialAccounts === -1
                        ? 'Unlimited'
                        : plan.limits.maxSocialAccounts}{' '}
                      social accounts
                    </li>
                    <li>
                      {plan.limits.maxPostsPerMonth === -1
                        ? 'Unlimited'
                        : plan.limits.maxPostsPerMonth}{' '}
                      posts/month
                    </li>
                    <li>
                      {plan.limits.maxTeamMembers === -1
                        ? 'Unlimited'
                        : plan.limits.maxTeamMembers}{' '}
                      team members
                    </li>
                    <li>
                      {plan.limits.aiCreditsPerMonth === -1
                        ? 'Unlimited'
                        : plan.limits.aiCreditsPerMonth}{' '}
                      AI credits/month
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Need help choosing? Contact our sales team for personalized recommendations.
          </p>
        </div>
      </div>
    </div>
  );
}
