import mongoose from 'mongoose';

async function checkDB() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/social-media-scheduler');
    
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const Workspace = mongoose.model('Workspace', new mongoose.Schema({}, { strict: false }), 'workspaces');
    const WorkspaceMember = mongoose.model('WorkspaceMember', new mongoose.Schema({}, { strict: false }), 'workspacemembers');
    
    const user = await User.findOne({ email: 'audit1@test.com' });
    console.log('USER:', user ? 'YES' : 'NO');
    
    if (user) {
      const workspace = await Workspace.findOne({ ownerId: user._id });
      console.log('WORKSPACE:', workspace ? 'YES' : 'NO');
      
      if (workspace) {
        const member = await WorkspaceMember.findOne({ workspaceId: workspace._id, userId: user._id });
        console.log('MEMBER:', member ? 'YES' : 'NO');
      } else {
        console.log('MEMBER:', 'NO');
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

checkDB();
