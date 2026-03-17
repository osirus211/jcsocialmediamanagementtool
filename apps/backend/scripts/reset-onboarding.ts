import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { User } from '../src/models/User';

async function main() {
  const emailArg = process.argv[2];

  if (!emailArg) {
    console.error('Usage: npx tsx scripts/reset-onboarding.ts <email>');
    process.exit(1);
  }

  try {
    await connectDatabase();

    const email = emailArg.toLowerCase().trim();
    const user = await User.findOne({ email, softDeletedAt: null });

    if (!user) {
      console.error(`No active user found with email: ${email}`);
      process.exitCode = 1;
      return;
    }

    user.onboardingCompleted = false;
    user.onboardingStep = 0;
    await user.save();

    console.log(
      `Onboarding reset for ${user.email} (id=${user._id}), step=${user.onboardingStep}`
    );
  } catch (err) {
    console.error('Error resetting onboarding:', err);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await disconnectDatabase().catch(() => {});
    }
  }
}

void main();

