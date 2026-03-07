import { MongoClient, ObjectId } from 'mongodb';

async function testPopulate() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/social-media-tool');
  await client.connect();
  const db = client.db();
  
  const now = new Date();
  
  // Get one recovery test post
  const post = await db.collection('posts').findOne({
    'metadata.testType': 'recovery_test'
  });
  
  console.log('Sample post:');
  console.log('  _id:', post._id);
  console.log('  socialAccountId:', post.socialAccountId);
  console.log('  socialAccountId type:', typeof post.socialAccountId);
  console.log('  socialAccountId is ObjectId?', post.socialAccountId instanceof ObjectId);
  
  // Check if the social account exists
  const account = await db.collection('socialaccounts').findOne({
    _id: post.socialAccountId
  });
  
  console.log('\nSocial account exists?', !!account);
  if (account) {
    console.log('  Account status:', account.status);
  }
  
  await client.close();
}

testPopulate();
