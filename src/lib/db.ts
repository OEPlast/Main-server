import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error('Mongodb URI is not defined');
    }
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error('MongoDB connection error: ' + error.message);
    } else {
      throw new Error('MongoDB connection error: Unknown error');
    }
  }
};

export default connectDB;
