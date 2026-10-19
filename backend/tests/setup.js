import path from 'path';
import os from 'os';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Point directly to locally extracted mongod binary
const cachedBinary = path.join(os.homedir(), '.cache', 'mongodb-binaries', '6.0.14', 'mongod.exe');
process.env.MONGOMS_SYSTEM_BINARY = cachedBinary;

let mongoServer;

export const connectTestDb = async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      systemBinary: cachedBinary,
    },
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  return uri;
};

export const clearTestDb = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
};

export const closeTestDb = async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
};
