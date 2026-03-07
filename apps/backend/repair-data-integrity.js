/**
 * DATA INTEGRITY REPAIR
 * Safely removes orphaned and corrupted workspace member records
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function repairDataIntegrity() {
  console.log('🔧 DATA INTEGRITY REPAIR\n');
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

    // REPAIR 1: Remove workspace members with null workspace
    console.log('REPAIR 1: Remove Members with NULL Workspace');
    console.log('-'.repeat(70));
    
    const nullWorkspaceMembers = await WorkspaceMember.find({ workspace: null });
    console.log(`Found ${nullWorkspaceMembers.length} members with null workspace`);
    
    if (nullWorkspaceMembers.length > 0) {
      const result = await WorkspaceMember.deleteMany({ workspace: null });
      console.log(`✅ Deleted ${result.deletedCount} orphaned members`);
    } else {
      console.log('✅ No members with null workspace to remove');
    }
    console.log('');

    // REPAIR 2: Remove workspace members referencing non-existent workspaces
    console.log('REPAIR 2: Remove Members with Invalid Workspace References');
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
    
    console.log(`Found ${orphanedMembers.length} members with invalid workspace references`);
    
    if (orphanedMembers.length > 0) {
      const orphanedIds = orphanedMembers.map(m => m._id);
      const result = await WorkspaceMember.deleteMany({ _id: { $in: orphanedIds } });
      console.log(`✅ Deleted ${result.deletedCount} orphaned members`);
    } else {
      console.log('✅ No orphaned members to remove');
    }
    console.log('');

    // REPAIR 3: Remove duplicate workspace memberships (keep oldest)
    console.log('REPAIR 3: Remove Duplicate Workspace Memberships');
    console.log('-'.repeat(70));
    
    const duplicates = await WorkspaceMember.aggregate([
      {
        $group: {
          _id: { workspace: '$workspace', user: '$user' },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          createdAts: { $push: '$createdAt' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);
    
    console.log(`Found ${duplicates.length} duplicate memberships`);
    
    let totalDuplicatesRemoved = 0;
    for (const dup of duplicates) {
      // Keep the first (oldest) ID, remove the rest
      const idsToRemove = dup.ids.slice(1);
      const result = await WorkspaceMember.deleteMany({ _id: { $in: idsToRemove } });
      totalDuplicatesRemoved += result.deletedCount;
      console.log(`   Removed ${result.deletedCount} duplicate(s) for workspace ${dup._id.workspace}, user ${dup._id.user}`);
    }
    
    if (totalDuplicatesRemoved > 0) {
      console.log(`✅ Deleted ${totalDuplicatesRemoved} duplicate memberships`);
    } else {
      console.log('✅ No duplicate memberships to remove');
    }
    console.log('');

    // VERIFICATION
    console.log('VERIFICATION: Re-checking Data Integrity');
    console.log('-'.repeat(70));
    
    const remainingNullMembers = await WorkspaceMember.countDocuments({ workspace: null });
    const remainingMembers = await WorkspaceMember.find({ workspace: { $ne: null } });
    const remainingWorkspaceIds = [...new Set(remainingMembers.map(m => m.workspace.toString()))];
    const remainingExistingWorkspaces = await Workspace.find({ 
      _id: { $in: remainingWorkspaceIds } 
    }).select('_id');
    const remainingExistingIds = new Set(remainingExistingWorkspaces.map(w => w._id.toString()));
    const remainingOrphaned = remainingMembers.filter(m => 
      !remainingExistingIds.has(m.workspace.toString())
    );
    
    const remainingDuplicates = await WorkspaceMember.aggregate([
      {
        $group: {
          _id: { workspace: '$workspace', user: '$user' },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);
    
    console.log(`Null workspace members: ${remainingNullMembers}`);
    console.log(`Orphaned members: ${remainingOrphaned.length}`);
    console.log(`Duplicate memberships: ${remainingDuplicates.length}`);
    console.log('');

    // SUMMARY
    console.log('='.repeat(70));
    console.log('REPAIR SUMMARY');
    console.log('-'.repeat(70));
    
    if (remainingNullMembers === 0 && remainingOrphaned.length === 0 && remainingDuplicates.length === 0) {
      console.log('✅ DATA INTEGRITY: CLEAN');
      console.log('   All orphaned and corrupted records removed');
      console.log('   Database is now in a consistent state');
    } else {
      console.log('⚠️  DATA INTEGRITY: ISSUES REMAIN');
      console.log(`   - Null workspace members: ${remainingNullMembers}`);
      console.log(`   - Orphaned members: ${remainingOrphaned.length}`);
      console.log(`   - Duplicate memberships: ${remainingDuplicates.length}`);
    }
    console.log('');

    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

repairDataIntegrity();
