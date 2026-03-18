export default async function globalTeardown() {
  const mongo = (global as any).__MONGOD__;
  
  if (mongo) {
    await mongo.stop();
    console.log('MongoDB Memory Server stopped');
  }
}