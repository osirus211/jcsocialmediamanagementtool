const mongoose = require('mongoose');
require('dotenv').config();

const verify = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('=== DATABASE VERIFICATION ===\n');
    
    // Extract DB info
    const dbName = mongoose.connection.db.databaseName;
    const mongoUri = process.env.MONGODB_URI;
    const host = mongoUri.match(/\/\/([^\/]+)\//)?.[1] || 'unknown';
    
    console.log('Active DB name:', dbName);
    console.log('Mongo URI host:', host);
    console.log('');
    
    // Check User (with refreshTokens field)
    const User = mongoose.connection.collection('users');
    const user = await User.findOne(
      { email: 'runtime1@test.com' },
      { projection: { password: 0 } } // Exclude password
    );
    
    console.log('User persisted:', user ? 'YES' : 'NO');
    if (user) {
      console.log('  User ID:', user._id.toString());
      console.log('  Name:', user.firstName, user.lastName);
      console.log('  Email:', user.email);
      console.log('  Provider:', user.provider);
      console.log('  Email Verified:', user.isEmailVerified);
      console.log('  Refresh Tokens Count:', user.refreshTokens?.length || 0);
    }
    console.log('');
    
    // Check if refresh tokens are stored in user document
    const hasRefreshTokens = user?.refreshTokens && user.refreshTokens.length > 0;
    console.log('Refresh token stored:', hasRefreshTokens ? 'YES' : 'NO');
    if (hasRefreshTokens) {
      console.log('  Tokens in array:', user.refreshTokens.length);
      console.log('  First token (masked):', user.refreshTokens[0].substring(0, 20) + '...');
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
      console.log('  Owner ID:', workspace.ownerId.toString());
    }
    console.log('');
    
    // Check WorkspaceMember
    const WorkspaceMember = mongoose.connection.collection('workspacemembers');
    const member = await WorkspaceMember.findOne({ 
      userId: user?._id
    });
    console.log('Membership exists:', member ? 'YES' : 'NO');
    if (member) {
      console.log('  Member ID:', member._id.toString());
      console.log('  Workspace ID:', member.workspaceId.toString());
      console.log('  Role:', member.role);
      console.log('  User ID:', member.userId.toString());
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Verification complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

verify();
