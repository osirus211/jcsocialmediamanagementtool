/**
 * DATA INTEGRITY CHECK
 * Scans for orphaned workspaceMembers and data corruption
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function checkDataIntegrity() {
  console.log('🔍 DATA INTEGRITY CHECK\n');
  console.log('='.repeat(70) + '\n');

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Define schemas
    const WorkspaceMember = mongoose.model('WorkspaceMember', new mongoose.Schema({
      workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role: String,
    }));

    const Workspace = mongoose.model('Workspace', new mongoose.Schema({
      name: String,
      ownerId: mongoose.Schema.Types.ObjectId,
    }));

    // CHECK 1: Workspace members with null workspace
    console.log('CHECK 1: Workspace Members with NULL workspace');
    console.log('-'.repeat(70));
    
    const nullWorkspaceMembers = await WorkspaceMember.find({ workspace: null });
    console.log(`Found ${nullWorkspaceMembers.length} members with null workspace`);
    
    if (nullWorkspaceMembers.length > 0) {
      console.log('⚠️  ISSUE: Orphaned members with null workspace:');
      nullWorkspaceMembers.forEach(member => {
        console.log(`   - Member ID: ${member._id}, User: ${member.user}, Role: ${member.role}`);
      });
    } else {
      console.log('✅ No members with null workspace');
    }
    console.log('');

    // CHECK 2: Workspace members referencing non-existent workspaces
    console.log('CHECK 2: Workspace Members with Invalid Workspace References');
    console.log('-'.repeat(70));
    
    const allMembers = await WorkspaceMember.find({ workspace: { $ne: null } });
    const workspaceIds = [...new Set(allMembers.map(m => m.workspace.toString()))];
    
    const existingWorkspaces = await Workspace.find({ 
      _id: { $in: workspaceIds } 
    }).select('_id');
    
    const existingWorkspaceIds = new Set(existingWorkspaces.map(w => w._id.toString()));
    
    const orphanedMembers = allMembers.filter(m => 
      !existingWorkspaceIds.has(m.workspace.toString())
    );
    
    console.log(`Total members: ${allMembers.length}`);
    console.log(`Unique workspaces referenced: ${workspaceIds.length}`);
    console.log(`Existing workspaces: ${existingWorkspaces.length}`);
    console.log(`Orphaned members: ${orphanedMembers.length}`);
    
    if (orphanedMembers.length > 0) {
      console.log('⚠️  ISSUE: Members referencing non-existent workspaces:');
      orphanedMembers.forEach(member => {
        console.log(`   - Member ID: ${member._id}, Workspace: ${member.workspace}, User: ${member.user}`);
      });
    } else {
      console.log('✅ All members reference valid workspaces');
    }
    console.log('');

    // CHECK 3: Duplicate workspace memberships
    console.log('CHECK 3: Duplicate Workspace Memberships');
    console.log('-'.repeat(70));
    
    const duplicates = await WorkspaceMember.aggregate([
      {
        $group: {
          _id: { workspace: '$workspace', user: '$user' },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);
    
    console.log(`Found ${duplicates.length} duplicate memberships`);
    
    if (duplicates.length > 0) {
      console.log('⚠️  ISSUE: Duplicate memberships:');
      duplicates.forEach(dup => {
        console.log(`   - Workspace: ${dup._id.workspace}, User: ${dup._id.user}, Count: ${dup.count}`);
        console.log(`     IDs: ${dup.ids.join(', ')}`);
      });
    } else {
      console.log('✅ No duplicate memberships');
    }
    console.log('');

    // SUMMARY
    console.log('='.repeat(70));
    console.log('SUMMARY');
    console.log('-'.repeat(70));
    
    const totalIssues = nullWorkspaceMembers.length + orphanedMembers.length + duplicates.length;
    
    if (totalIssues === 0) {
      console.log('✅ DATA INTEGRITY: CLEAN');
      console.log('   No orphaned or corrupted records found');
    } else {
      console.log('⚠️  DATA INTEGRITY: ISSUES FOUND');
      console.log(`   - Null workspace members: ${nullWorkspaceMembers.length}`);
      console.log(`   - Orphaned members: ${orphanedMembers.length}`);
      console.log(`   - Duplicate memberships: ${duplicates.length}`);
      console.log(`   - Total issues: ${totalIssues}`);
    }
    console.log('');

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDataIntegrity();
