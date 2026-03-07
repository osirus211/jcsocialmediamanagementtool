const mongoose = require('mongoose');
require('dotenv').config();

const verify = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('=== DATABASE VERIFICATION ===\n');
    
    // Extract DB info
    const dbName = mongoose.connection.db.databaseName;
    const mongoUri = process.env.MONGODB_URI;
    const host = mongoUri.match(/\/\/([^\/]+)\//)?.[1] || 'unknown';
    
    console.log('Active DB name:', dbName);
    console.log('Mongo URI host:', host);
    console.log('');
    
    // Check User
    const User = mongoose.connection.collection('users');
    const user = await User.findOne({ email: 'runtime1@test.com' });
    console.log('User persisted:', user ? 'YES' : 'NO');
    if (user) {
      console.log('  User ID:', user._id.toString());
      console.log('  Name:', user.firstName, user.lastName);
      console.log('  Email:', user.email);
    }
    console.log('');
    
    // Check RefreshToken
    const RefreshToken = mongoose.connection.collection('refreshtokens');
    const token = await RefreshToken.findOne({ userId: user?._id });
    console.log('Refresh token stored:', token ? 'YES' : 'NO');
    if (token) {
      console.log('  Token ID:', token._id.toString());
      console.log('  Expires:', token.expiresAt);
    }
    console.log('');
    
    // Check Workspace
    const Workspace = mongoose.connection.collection('workspaces');
    const workspace = await Workspace.findOne({ ownerId: user?._id });
    console.log('Workspace created:', workspace ? 'YES' : 'NO');
    if (workspace) {
      console.log('  Workspace ID:', workspace._id.toString());
      console.log('  Name:', workspace.name);
      console.log('  Slug:', workspace.slug);
      console.log('  Plan:', workspace.plan);
    }
    console.log('');
    
    // Check WorkspaceMember
    const WorkspaceMember = mongoose.connection.collection('workspacemembers');
    const member = await WorkspaceMember.findOne({ 
      userId: user?._id,
      workspaceId: workspace?._id 
    });
    console.log('Membership exists:', member ? 'YES' : 'NO');
    if (member) {
      console.log('  Member ID:', member._id.toString());
      console.log('  Role:', member.role);
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Verification complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

verify();
