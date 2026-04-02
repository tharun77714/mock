'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Vapi from '@vapi-ai/web';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Loader2,
  Sparkles, X, Upload, FileText, CheckCircle, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function buildResumeAssistant(resumeText: string) {
  const systemPrompt = `You are a senior technical interviewer conducting a professional mock interview. You have access to the candidate's resume below.

=== CANDIDATE RESUME ===
${resumeText.slice(0, 6000)}
=== END RESUME ===

INSTRUCTIONS:
- Start by welcoming the candidate, then ask them to briefly introduce themselves.
- Ask 8-10 targeted questions based on their resume: projects they listed, skills they claim, past experience, education.
- Mix behavioral questions ("Tell me about a time when...") with technical questions relevant to their listed skills.
- If they mention specific technologies (Python, React, ML, etc.), ask deeper follow-up questions about those.
- Be conversational but professional — like a real interviewer at a top company.
- Give brief encouraging acknowledgments between questions ("Great, thanks for sharing that.").
- After all questions, wrap up by asking if they have any questions for you.
- Keep each question concise (1-2 sentences max).
- Do NOT read back the entire resume. Reference specifics naturally ("I see you worked on X project...").`;

  return {
    name: "MockMate Resume Interviewer",
    firstMessage:
      "Hi there! Thanks for joining this mock interview session. I've had a chance to review your resume, and I'm excited to learn more about your background. Let's get started — could you give me a quick introduction about yourself?",
    model: {
      provider: "openai" as const,
      model: "gpt-4o-mini",
      messages: [{ role: "system" as const, content: systemPrompt }],
      temperature: 0.7,
    },
    voice: {
      provider: "11labs" as const,
      voiceId: "21m00Tcm4TlvDq8ikWAM",
    },
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 1200,
  };
}

export default function InterviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState<string>("");
  const [resumeParsing, setResumeParsing] = useState(false);
  const [resumeError, setResumeError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);   // ← keep track of camera stream
  const chunksRef = useRef<Blob[]>([]);
  const messagesRef = useRef<{ role: string; text: string }[]>([]);
  const vapiRef = useRef<InstanceType<typeof Vapi> | null>(null);
  const listenersAttached = useRef(false);
  const uploadTriggeredRef = useRef(false);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    messagesRef.current = messages;
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Stop camera & mic tracks immediately
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
      console.log(`[Camera] stopped track: ${track.kind}`);
    });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const doUpload = useCallback(async () => {
    if (uploadTriggeredRef.current) return;
    uploadTriggeredRef.current = true;
    setIsUploading(true);
    stopCamera();  // ← turn off camera as soon as interview ends

    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    const formData = new FormData();
    formData.append("video", blob, "interview.webm");
    formData.append("transcript", JSON.stringify(messagesRef.current));

    try {
      const resp = await fetch("/api/interviews", { method: "POST", body: formData });
      const data = await resp.json();
      if (data.success) {
        router.push(`/interview/${data.interviewId}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error("Upload error:", err);
      router.push('/dashboard');
    }
  }, [router, stopCamera]);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: true,
        });

        streamRef.current = stream;  // ← save ref so we can stop it later

        const tryAttach = () => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          } else {
            setTimeout(tryAttach, 100);
          }
        };
        tryAttach();

        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          console.log("[Recorder] stopped, chunks:", chunksRef.current.length);
          doUpload();
        };
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    }
    setupCamera();

    return () => {
      stream?.getTracks().forEach((track) => track.stop()); // cleanup on unmount
    };
  }, [doUpload]);

  useEffect(() => {
    if (listenersAttached.current) return;

    const v = new Vapi(process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN || "");
    vapiRef.current = v;

    v.on("call-start", () => {
      console.log("[Vapi] call-start");
      setIsConnected(true);
      setIsConnecting(false);
      uploadTriggeredRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "inactive") {
        mediaRecorderRef.current.start();
        console.log("[Recorder] started");
      }
    });

    v.on("call-end", () => {
      console.log("[Vapi] call-end");
      setIsConnected(false);
      setIsConnecting(false);

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        console.log("[Recorder] stopping...");
        mediaRecorderRef.current.stop();
      } else {
        console.log("[Recorder] was not recording, uploading directly");
        doUpload();
      }
    });

    v.on("message", (message: any) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const role = message.role === "assistant" ? "interviewer" : "you";
        setMessages((prev) => {
          const updated = [...prev, { role, text: message.transcript }];
          messagesRef.current = updated;
          return updated;
        });
      }
    });

    v.on("error", (e: any) => {
      console.error("[Vapi] error:", e);
      setIsConnecting(false);
    });

    listenersAttached.current = true;
  }, [doUpload]);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setResumeError("Please upload a PDF file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setResumeError("File too large (max 10 MB)");
      return;
    }

    setResumeFile(file);
    setResumeError("");
    setResumeParsing(true);

    try {
      const formData = new FormData();
      formData.append("resume", file);
      const resp = await fetch("/api/resume/parse", { method: "POST", body: formData });
      const data = await resp.json();

      if (data.success && data.text) {
        setResumeText(data.text);
        setResumeError("");
      } else {
        setResumeError(data.error || "Failed to parse resume");
        setResumeFile(null);
      }
    } catch {
      setResumeError("Failed to upload resume");
      setResumeFile(null);
    } finally {
      setResumeParsing(false);
    }
  };

  const removeResume = () => {
    setResumeFile(null);
    setResumeText("");
    setResumeError("");
  };

  const startInterview = async () => {
    setIsConnecting(true);
    chunksRef.current = [];
    setMessages([]);
    messagesRef.current = [];
    uploadTriggeredRef.current = false;

    try {
      if (resumeText) {
        const assistantConfig = buildResumeAssistant(resumeText);
        await vapiRef.current?.start(assistantConfig as any);
      } else {
        await vapiRef.current?.start(
          process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID || ""
        );
      }
    } catch (err) {
      console.error("Failed to start Vapi:", err);
      setIsConnecting(false);
    }
  };

  const endInterview = () => {
    vapiRef.current?.stop();
  };

  const cancelInterview = () => {
    vapiRef.current?.stop();
    setIsConnecting(false);
    setIsConnected(false);
    uploadTriggeredRef.current = true;
  };

  if (status === "loading") return null;

  return (
    <main className="flex h-screen flex-col bg-slate-950 overflow-hidden">
      <Navbar />

      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-[1600px] mx-auto w-full min-h-0">
        {/* Left column: Video + Controls */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Video feed */}
          <div className="relative aspect-video rounded-3xl bg-slate-900 border border-white/10 overflow-hidden shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`h-full w-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${
                isVideoOff ? "opacity-0" : "opacity-100"
              }`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                <div className="h-20 w-20 rounded-full bg-slate-700 flex items-center justify-center">
                  <VideoOff className="h-10 w-10 text-slate-500" />
                </div>
              </div>
            )}

            <div className="absolute top-6 left-6 flex items-center gap-3">
              <AnimatePresence>
                {isConnected && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/50 backdrop-blur-md"
                  >
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
                      Live Session
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              {resumeText && isConnected && (
                <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 backdrop-blur-md">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Resume-Based
                  </span>
                </div>
              )}
              <div className="px-3 py-1.5 rounded-full bg-slate-900/60 border border-white/10 backdrop-blur-md">
                <span className="text-xs font-medium text-slate-300">
                  {session?.user?.name}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 bg-slate-900/50 p-6 rounded-3xl border border-white/10 backdrop-blur-xl">
            <Button
              variant="secondary"
              className={`!rounded-full p-4 ${isMuted ? "bg-red-500/20 text-red-500" : ""}`}
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>

            <Button
              variant="secondary"
              className={`!rounded-full p-4 ${isVideoOff ? "bg-red-500/20 text-red-500" : ""}`}
              onClick={() => setIsVideoOff(!isVideoOff)}
            >
              {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
            </Button>

            <div className="mx-4 h-8 w-px bg-white/10" />

            {isUploading ? (
              <Button size="lg" className="px-8 font-bold gap-3" disabled>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analysing Interview...
              </Button>
            ) : isConnected ? (
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700 px-8 font-bold gap-3"
                onClick={endInterview}
              >
                <PhoneOff className="h-5 w-5" />
                End Session
              </Button>
            ) : isConnecting ? (
              <div className="flex items-center gap-3">
                <Button size="lg" className="px-8 font-bold gap-3" disabled>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Initialising AI...
                </Button>
                <Button
                  variant="secondary"
                  className="!rounded-full p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={cancelInterview}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <Button
                size="lg"
                className="px-8 font-bold gap-3"
                onClick={startInterview}
              >
                <Sparkles className="h-5 w-5" />
                Begin Mock Interview
              </Button>
            )}
          </div>
        </div>

        {/* Right column: Resume + Transcript */}
        <div className="w-full lg:w-96 flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Resume Upload Section */}
          {!isConnected && !isUploading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl bg-slate-900/50 border border-white/10 p-6 backdrop-blur-xl"
            >
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <Upload className="h-4 w-4 text-indigo-400" />
                Upload Resume
              </h2>

              {!resumeFile ? (
                <label className="flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-dashed border-white/10 hover:border-indigo-500/50 transition-colors cursor-pointer group">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleResumeUpload}
                    className="hidden"
                  />
                  <FileText className="h-8 w-8 text-slate-500 group-hover:text-indigo-400 transition-colors mb-2" />
                  <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                    Drop your resume PDF here
                  </span>
                  <span className="text-xs text-slate-600 mt-1">
                    PDF only, max 10 MB
                  </span>
                </label>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-white/5">
                  {resumeParsing ? (
                    <Loader2 className="h-5 w-5 text-indigo-400 animate-spin shrink-0" />
                  ) : resumeText ? (
                    <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                  ) : (
                    <FileText className="h-5 w-5 text-red-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {resumeFile.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {resumeParsing
                        ? "Parsing..."
                        : resumeText
                          ? `Parsed (${resumeText.split(/\s+/).length} words)`
                          : resumeError || "Error"}
                    </p>
                  </div>
                  <button
                    onClick={removeResume}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              {resumeError && (
                <p className="text-xs text-red-400 mt-2">{resumeError}</p>
              )}

              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                {resumeText
                  ? "The AI interviewer will ask questions based on your resume — projects, skills, and experience."
                  : "Optional: Upload your resume and the AI will ask targeted questions about your experience."}
              </p>
            </motion.div>
          )}

          {/* Transcript — fixed height, only this box scrolls */}
          <div className="flex-1 min-h-0 rounded-3xl bg-slate-900/50 border border-white/10 p-6 flex flex-col overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Loader2
                  className={`h-4 w-4 text-indigo-400 ${isConnected ? "animate-spin" : ""}`}
                />
                Real-time Transcript
              </h2>
            </div>

            <div
              ref={transcriptScrollRef}
              className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar text-sm leading-relaxed"
            >
              {messages.length > 0 ? (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col gap-1 ${
                      msg.role === "you" ? "items-end" : "items-start"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest ${
                        msg.role === "interviewer"
                          ? "text-indigo-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {msg.role === "interviewer" ? "Interviewer" : "You"}
                    </span>
                    <p
                      className={`px-3 py-2 rounded-2xl max-w-[85%] ${
                        msg.role === "interviewer"
                          ? "bg-slate-800/80 text-slate-300"
                          : "bg-indigo-600/20 text-slate-300"
                      }`}
                    >
                      {msg.text}
                    </p>
                  </div>
                ))
              ) : (
                <p className="italic opacity-50 text-slate-400">
                  Transcripts will appear here once the conversation begins...
                </p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="p-6 rounded-3xl bg-indigo-600/10 border border-indigo-500/20">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-2">
              Internal AI Status
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isUploading
                ? "Processing your interview recording and running EfficientNet-B0 emotion analysis..."
                : isConnected
                  ? resumeText
                    ? "Resume-based interview active. AI is asking questions tailored to your experience."
                    : "VAPI agent is listening. Speak naturally — don't worry about being perfect."
                  : isConnecting
                    ? "Connecting to AI interviewer..."
                    : resumeText
                      ? "Resume loaded. Click 'Begin Mock Interview' to start a personalized session."
                      : "Upload your resume for targeted questions, or start a general interview."}
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </main>
  );
}
