const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Connect to MongoDB
mongoose.connect('mongodb://admin:admin123@localhost:27017/social_scheduler?authSource=admin');

// User schema (simplified)
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  firstName: String,
  lastName: String,
  role: { type: String, default: 'member' },
  isEmailVerified: { type: Boolean, default: true },
  provider: { type: String, default: 'local' },
  refreshTokens: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createUser() {
  try {
    const hashedPassword = await bcrypt.hash('Password123', 12);
    
    const user = new User({
      email: 'apitest@example.com',
      password: hashedPassword,
      firstName: 'API',
      lastName: 'Test'
    });
    
    await user.save();
    console.log('User created successfully:', user.email);
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error);
    process.exit(1);
  }
}

createUser();