const mongoose = require('mongoose');
require('dotenv').config();

async function runMigration() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/socialmedia');
    console.log('Connected to MongoDB');

    // Import and run the migration
    const { up } = require('./src/migrations/add-workspace-deleted-at.ts');
    await up();
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

runMigration();