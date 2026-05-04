import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  provider?: string;
  role: 'user' | 'admin' | 'guest';
  firstName?: string;
  lastName?: string;
  resumeUrl?: string;
  githubLink?: string;
  linkedinLink?: string;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    image: { type: String },
    provider: { type: String },
    role: { type: String, enum: ['user', 'admin', 'guest'], default: 'user' },
    firstName: { type: String },
    lastName: { type: String },
    resumeUrl: { type: String },
    githubLink: { type: String },
    linkedinLink: { type: String },
  },
  { timestamps: true }
);

export default (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema);

