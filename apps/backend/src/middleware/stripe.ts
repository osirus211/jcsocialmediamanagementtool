import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * Middleware to check if Stripe is properly configured
 * Returns 503 Service Unavailable if Stripe is not configured
 */
export const requireStripe = (req: Request, res: Response, next: NextFunction): void => {
  const isStripeConfigured = config.stripe.secretKey && 
    config.stripe.secretKey !== 'your-stripe-secret-key' && 
    config.stripe.secretKey.startsWith('sk_');

  if (!isStripeConfigured) {
    res.status(503).json({ 
      error: 'Billing service unavailable',
      message: 'Stripe is not configured on this server'
    });
    return;
  }

  next();
};