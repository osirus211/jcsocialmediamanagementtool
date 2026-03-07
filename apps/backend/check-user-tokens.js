import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';

async function checkUserTokens() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const user = await User.findOne({ email: 'prodtest@example.com' });

    if (user) {
      console.log('User found:');
      console.log('Email:', user.email);
      console.log('Refresh Tokens Count:', user.refreshTokens ? user.refreshTokens.length : 0);
      console.log('Refresh Tokens:', user.refreshTokens);
    } else {
      console.log('User not found');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUserTokens();
