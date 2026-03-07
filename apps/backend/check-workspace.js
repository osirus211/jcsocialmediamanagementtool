import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-media-scheduler';

async function checkWorkspace() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const Workspace = mongoose.model('Workspace', new mongoose.Schema({}, { strict: false }));
    const WorkspaceMember = mongoose.model('WorkspaceMember', new mongoose.Schema({}, { strict: false }));
    const Plan = mongoose.model('Plan', new mongoose.Schema({}, { strict: false }));

    const workspace = await Workspace.findOne({ slug: 'prod-test-workspace' });
    console.log('=== WORKSPACE ===');
    if (workspace) {
      console.log('✓ Workspace exists');
      console.log('  ID:', workspace._id.toString());
      console.log('  Name:', workspace.name);
      console.log('  Slug:', workspace.slug);
      console.log('  Plan:', workspace.plan);
      console.log('  Owner ID:', workspace.ownerId.toString());
      console.log('  Members Count:', workspace.membersCount);
    } else {
      console.log('✗ Workspace not found');
    }

    console.log('\n=== WORKSPACE MEMBER ===');
    const member = await WorkspaceMember.findOne({ workspaceId: workspace._id });
    if (member) {
      console.log('✓ WorkspaceMember exists');
      console.log('  User ID:', member.userId.toString());
      console.log('  Workspace ID:', member.workspaceId.toString());
      console.log('  Role:', member.role);
    } else {
      console.log('✗ WorkspaceMember not found');
    }

    console.log('\n=== PLAN ===');
    const plan = await Plan.findOne({ name: 'free' });
    if (plan) {
      console.log('✓ FREE Plan exists');
      console.log('  Name:', plan.name);
      console.log('  Price:', plan.price);
      console.log('  Limits:', JSON.stringify(plan.limits, null, 2));
    } else {
      console.log('✗ FREE Plan not found');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkWorkspace();
