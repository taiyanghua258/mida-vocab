require('dotenv').config();
const mongoose = require('mongoose');

async function clearDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Successfully connected to database.');

    // Drop the entire database
    console.log('Dropping the my-vocab database...');
    await mongoose.connection.db.dropDatabase();
    
    console.log('✅ Database cleared successfully! Your website is now ready for a fresh start.');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

clearDatabase();
