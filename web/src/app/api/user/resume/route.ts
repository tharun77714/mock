import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Clean filename
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const fileName = `${session.user.email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${safeName}`;
    
    // Ensure public/uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);
    
    // The public URL is just /uploads/filename
    const resumeUrl = `/uploads/${fileName}`;
    
    await dbConnect();
    const user = await User.findOneAndUpdate(
      { email: session.user.email }, 
      { $set: { resumeUrl: resumeUrl } }, 
      { new: true, strict: false }
    );
    
    return NextResponse.json({ resumeUrl });
  } catch (error) {
    console.error('Error uploading resume:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
