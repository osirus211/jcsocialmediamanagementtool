import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { User } from '../src/models/User';

async function main() {
  const emailArg = process.argv[2];

  if (!emailArg) {
    console.error('Usage: npx tsx scripts/mark-email-verified.ts <email>');
    process.exit(1);
  }

  try {
    await connectDatabase();

    const email = emailArg.toLowerCase().trim();
    const result = await User.findOneAndUpdate(
      { email, softDeletedAt: null },
      { $set: { isEmailVerified: true } },
      { new: true }
    );

    if (!result) {
      console.error(`No active user found with email: ${email}`);
      process.exitCode = 1;
    } else {
      console.log(`Marked email as verified: ${result.email} (id=${result._id})`);
    }
  } catch (err) {
    console.error('Error marking email verified:', err);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await disconnectDatabase().catch(() => {});
    }
  }
}

void main();

