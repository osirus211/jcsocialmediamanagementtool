#!/usr/bin/env ts-node
/**
 * Seed Free Plan Script
 * 
 * Creates the FREE plan in the database if it doesn't exist.
 * Idempotent - safe to run multiple times.
 */

import dotenv from 'dotenv';
import { connectDatabase } from '../src/config/database';
import { Plan } from '../src/models/Plan';

// Load environment variables
dotenv.config({ path: '.env.production' });

async function seedFreePlan() {
  try {
    console.log('🌱 Seeding FREE plan...');

    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');

    // Check if FREE plan already exists
    const existingPlan = await Plan.findOne({ name: 'free' });
    
    if (existingPlan) {
      console.log('✅ FREE plan already exists - skipping');
      console.log(`   Plan ID: ${existingPlan._id}`);
      console.log(`   Display Name: ${existingPlan.displayName}`);
      console.log(`   Posts/Month: ${existingPlan.limits.maxPostsPerMonth}`);
      console.log(`   AI Credits: ${existingPlan.limits.aiCreditsPerMonth}`);
      return;
    }

    // Create FREE plan
    const freePlan = new Plan({
      name: 'free',
      displayName: 'Free',
      description: 'Perfect for getting started with social media scheduling',
      priceMonthly: 0,
      priceYearly: 0,
      limits: {
        maxSocialAccounts: 3,
        maxPostsPerMonth: 50,
        maxTeamMembers: 1,
        aiCreditsPerMonth: 20,
      },
      features: [
        '3 social accounts',
        '50 posts per month',
        'Basic analytics',
        '20 AI credits per month',
        'Community support',
      ],
      isActive: true,
    });

    await freePlan.save();

    console.log('✅ FREE plan created successfully!');
    console.log(`   Plan ID: ${freePlan._id}`);
    console.log(`   Display Name: ${freePlan.displayName}`);
    console.log(`   Posts/Month: ${freePlan.limits.maxPostsPerMonth}`);
    console.log(`   AI Credits: ${freePlan.limits.aiCreditsPerMonth}`);

  } catch (error) {
    console.error('❌ Error seeding FREE plan:', error);
    process.exit(1);
  } finally {
    // Close database connection
    process.exit(0);
  }
}

// Run the seed function
seedFreePlan();