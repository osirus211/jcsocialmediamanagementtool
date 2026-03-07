import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './apps/backend/.env' });

async function testBackendDB() {
  try {
    console.log('Connecting to:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected');
    
    const db = mongoose.connection.db;
    console.log('Database name:', db.databaseName);
    
    const Post = mongoose.model('Post', new mongoose.Schema({}, { collection: 'posts' }));
    
    const now = new Date();
    const count = await Post.countDocuments({
      status: 'scheduled',
      scheduledAt: { $lte: now }
    });
    
    console.log(`Eligible posts count: ${count}`);
    
    const sample = await Post.findOne({ status: 'scheduled' }).lean();
    if (sample) {
      console.log('Sample post:');
      console.log('  _id:', sample._id);
      console.log('  status:', sample.status);
      console.log('  scheduledAt:', sample.scheduledAt);
      console.log('  socialAccountId:', sample.socialAccountId);
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBackendDB();
