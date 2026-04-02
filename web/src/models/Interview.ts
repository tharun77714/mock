import mongoose, { Schema, Document } from 'mongoose';

export interface IInterview extends Document {
  userId: string;
  transcript: string;
  videoUrl?: string;
  audioUrl?: string;
  analysis?: {
    confidence: number;
    emotion: string;
    communication: string;
    suggestions: string[];
    eyeContact: { score: number; label: string };
    posture: { score: number; label: string; details: string };
    headStability: { score: number; label: string };
    facialExpression: { dominant: string; breakdown: Record<string, number> };
    fillerWords: { count: number; perMinute: number; details: Record<string, number> };
    speakingPace: { wpm: number; label: string };
    overallScore: number;
    voiceAnalysis?: {
      voice_emotion: string;
      confidence_score: number;
      pitch_score: number;
      fluency_score: number;
      energy_score: number;
    };
    englishCoaching?: Record<string, unknown>;
  };
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

const InterviewSchema: Schema = new Schema(
  {
    userId: { type: String, required: true },
    transcript: { type: String, required: true },
    videoUrl: { type: String },
    audioUrl: { type: String },
    analysis: {
      confidence: { type: Number, default: 0 },
      emotion: { type: String, default: "" },
      communication: { type: String, default: "" },
      suggestions: [{ type: String }],
      eyeContact: {
        score: { type: Number, default: 0 },
        label: { type: String, default: "" },
      },
      posture: {
        score: { type: Number, default: 0 },
        label: { type: String, default: "" },
        details: { type: String, default: "" },
      },
      headStability: {
        score: { type: Number, default: 0 },
        label: { type: String, default: "" },
      },
      facialExpression: {
        dominant: { type: String, default: "" },
        breakdown: { type: Schema.Types.Mixed, default: {} },
      },
      fillerWords: {
        count: { type: Number, default: 0 },
        perMinute: { type: Number, default: 0 },
        details: { type: Schema.Types.Mixed, default: {} },
      },
      speakingPace: {
        wpm: { type: Number, default: 0 },
        label: { type: String, default: "" },
      },
      overallScore: { type: Number, default: 0 },
      voiceAnalysis: {
        voice_emotion: { type: String, default: '' },
        confidence_score: { type: Number, default: 0 },
        pitch_score: { type: Number, default: 0 },
        fluency_score: { type: Number, default: 0 },
        energy_score: { type: Number, default: 0 },
      },
      englishCoaching: { type: Schema.Types.Mixed },
    },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.models.Interview || mongoose.model<IInterview>('Interview', InterviewSchema);
