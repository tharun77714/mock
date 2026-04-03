'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Vapi from '@vapi-ai/web';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Loader2,
  Sparkles, X, Upload, FileText, CheckCircle, Trash2,
  Briefcase, Building2, Zap, AlertCircle, Target, MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const JOB_ROLES = [
  "Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "Data Scientist",
  "Machine Learning Engineer",
  "DevOps / SRE",
  "Product Manager",
  "Business Analyst",
  "Data Analyst",
  "QA Engineer",
  "Mobile Engineer",
  "Security Engineer",
  "Cloud Architect",
  "Engineering Manager",
  "Financial Analyst",
  "Management Consultant",
  "Marketing Manager",
  "Sales Engineer",
  "Technical Recruiter",
];

interface InterviewContext {
  companyOverview: string;
  interviewStyle: string;
  keySkillsToTest: string[];
  interviewerPersona: string;
  behavioralFramework: string;
  sampleQuestions: { type: string; question: string; why: string }[];
  cultureFitFocus: string;
  interviewStructure: string;
  redFlags: string;
  tipsForSuccess: string;
  openingMessage: string;
}

function buildPersonalizedAssistant(
  jobRole: string,
  companyName: string,
  resumeText: string,
  context: InterviewContext | null
) {
  const company = companyName.trim() || "a leading tech company";
  const role = jobRole.trim() || "Software Engineer";
  const resumeBlock = resumeText
    ? `=== RESUME ===\n${resumeText.slice(0, 5000)}\n=== END ===`
    : "No resume — ask strong role- and company-appropriate questions.";

  const systemPrompt = context
    ? `${context.interviewerPersona}

You are running a mock interview for ${role} at ${company}. You are a SENIOR interviewer. Do NOT act like a generic chatbot.

=== COMPANY ===
${context.companyOverview}
Interview style: ${context.interviewStyle}
Culture / fit: ${context.cultureFitFocus}
Framework: ${context.behavioralFramework}
Tips for candidates: ${context.tipsForSuccess}
Red flags: ${context.redFlags}

${resumeBlock}

=== FLOW ===
${context.interviewStructure}

=== QUESTION BANK (adapt, do not read verbatim) ===
${context.sampleQuestions.map((q, i) => `${i + 1}. [${q.type}] ${q.question}`).join("\n")}

CRITICAL INTERVIEW GUIDELINES:
1. First spoken line must match this (verbatim): ${JSON.stringify(context.openingMessage)}
2. DO NOT just say "Great answer" and immediately ask the next distinct question.
3. CRITIQUE and PUSH BACK: If an answer is shallow, challenge them. ("That makes sense for a small app, but how would you handle 10 million concurrent users?", or "What's the tradeoff of that approach?")
4. Acknowledge what they said specifically, offer a tiny piece of feedback, then smoothly transition.
5. Limit to 8–10 total distinct questions throughout the session, but use aggressive follow-ups if they give weak answers.`
    : `You are a senior interviewer at ${company} hiring for ${role}.

${resumeBlock}

CRITICAL INSTRUCTIONS:
- You are a STRICT, SENIOR technical interviewer. Conduct a realistic mock interview.
- Start by welcoming them and asking for a brief intro.
- DO NOT just say "Great answer" and move to the next topic. 
- You MUST evaluate their answers. If they give a superficial answer, PUSH BACK ("Can you go deeper into the exact architecture?", or "What are the edge cases there?").
- Ask 8-10 targeted questions. Be professional, push for depth, and sound exactly like a hiring manager at a real tech company.`;

  const firstMessage =
    context?.openingMessage ||
    `Hi — I’m your interviewer today for the ${role} role${companyName.trim() ? ` at ${companyName.trim()}` : ""}. Before we dive in, tell me a bit about yourself.`;

  return {
    name: `MockMate — ${role} @ ${company}`,
    firstMessage,
    model: {
      provider: "openai" as const,
      model: "gpt-4o",
      messages: [{ role: "system" as const, content: systemPrompt }],
      temperature: 0.6,
    },
    voice: {
      provider: "11labs" as const,
      voiceId: "21m00Tcm4TlvDq8ikWAM",
    },
    clientMessages: ["transcript", "hangup", "speech-update"],
    silenceTimeoutSeconds: 60,
    maxDurationSeconds: 1800,
  };
}

function buildResumeAssistant(resumeText: string) {
  const systemPrompt = `You are a strict, senior-level interviewer conducting a professional mock interview. You have access to the candidate's resume below.

=== CANDIDATE RESUME ===
${resumeText.slice(0, 6000)}
=== END RESUME ===

CRITICAL INSTRUCTIONS:
- Start by welcoming the candidate, then ask them to briefly introduce themselves.
- Ask 8-10 targeted questions based strictly on the specifics in their resume (projects, skills, past experience).
- DO NOT just say "Great" and move on. You MUST act like a real engineering manager. 
- PUSH BACK: If they mention using "React" or "Python" or "AWS", grill them on it. Ask about tradeoffs, scaling, edge cases, or what the hardest bug was in the project they listed.
- If their answer is vague, say: "That's a bit high-level. Can you walk me through the exact technical implementation?"
- Keep your questions and responses concise (1-3 sentences max) but ruthless and professional.
- After all questions are exhausted, ask if they have any questions for you.`;

  return {
    name: "MockMate Resume Interviewer",
    firstMessage:
      "Hi there! Thanks for joining this mock interview session. I've had a chance to review your resume, and I'm excited to learn more about your background. Let's get started — could you give me a quick introduction about yourself?",
    model: {
      provider: "openai" as const,
      model: "gpt-4o",
      messages: [{ role: "system" as const, content: systemPrompt }],
      temperature: 0.6,
    },
    voice: {
      provider: "11labs" as const,
      voiceId: "21m00Tcm4TlvDq8ikWAM",
    },
    clientMessages: ["transcript", "hangup", "speech-update"],
    silenceTimeoutSeconds: 60,
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

  const [jobRole, setJobRole] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [interviewContext, setInterviewContext] = useState<InterviewContext | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  const [contextError, setContextError] = useState("");

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
    setContextReady(false);
    setInterviewContext(null);
  };

  const generateContext = async () => {
    if (!jobRole.trim()) {
      setContextError("Select a job role first.");
      return;
    }
    setIsGeneratingContext(true);
    setContextError("");
    setContextReady(false);
    setInterviewContext(null);
    try {
      const resp = await fetch("/api/interview-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ jobRole, companyName, resumeText }),
      });
      const data = await resp.json();
      if (data.success && data.context) {
        setInterviewContext(data.context);
        setContextReady(true);
      } else {
        setContextError(data.error || "Could not generate context");
      }
    } catch {
      setContextError("Network error — try again");
    } finally {
      setIsGeneratingContext(false);
    }
  };

  const startInterview = async () => {
    const wf = process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID || "";
    if (!jobRole.trim() && !resumeText) {
      if (!wf) {
        setContextError("Add a job role or resume, or set NEXT_PUBLIC_VAPI_WORKFLOW_ID.");
        return;
      }
    }

    setIsConnecting(true);
    chunksRef.current = [];
    setMessages([]);
    messagesRef.current = [];
    uploadTriggeredRef.current = false;

    try {
      if (jobRole.trim() || resumeText) {
        const cfg = buildPersonalizedAssistant(jobRole, companyName, resumeText, interviewContext);
        await vapiRef.current?.start(cfg as any);
      } else {
        await vapiRef.current?.start(wf);
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

  const hasWorkflow = Boolean(process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID);
  const canBegin = hasWorkflow || !!jobRole.trim() || !!resumeText;

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
              {(jobRole || companyName) && (
                <div className="px-3 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 backdrop-blur-md">
                  <span className="text-xs font-medium text-indigo-200">
                    {[jobRole, companyName].filter(Boolean).join(" @ ")}
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
                disabled={!canBegin}
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
            <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl bg-slate-900/50 border border-white/10 p-6 backdrop-blur-xl"
            >
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-indigo-400" />
                Interview setup
              </h2>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Job role <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="h-4 w-4 text-slate-500 shrink-0" />
                <select
                  value={jobRole}
                  onChange={(e) => {
                    setJobRole(e.target.value);
                    setContextReady(false);
                    setInterviewContext(null);
                  }}
                  className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
                >
                  <option value="">Select role…</option>
                  {JOB_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Company <span className="text-slate-600">(optional)</span>
              </label>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setContextReady(false);
                    setInterviewContext(null);
                  }}
                  placeholder="e.g. Google, Microsoft…"
                  className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/50"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full gap-2 mb-2 border-indigo-500/30 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-100"
                disabled={!jobRole.trim() || isGeneratingContext}
                onClick={generateContext}
              >
                {isGeneratingContext ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : contextReady ? (
                  <>
                    <Zap className="h-4 w-4" />
                    Regenerate context
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Generate interview context (AI)
                  </>
                )}
              </Button>
              {contextError && (
                <p className="text-xs text-red-400 flex items-start gap-1.5 mb-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {contextError}
                </p>
              )}
              <p className="text-xs text-slate-500 leading-relaxed">
                Free tier: set <code className="text-slate-400">GROQ_API_KEY</code> from{" "}
                <a href="https://console.groq.com/keys" className="text-indigo-400 underline" target="_blank" rel="noreferrer">
                  Groq
                </a>
                . Fallbacks: OpenAI, then Gemini. FastAPI on port 8000; <code className="text-slate-400">pip install openai</code> in API venv.
              </p>
            </motion.div>

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
                  ? "Combined with role, company, and generated context for sharper questions."
                  : "Optional — improves personalization with role and company."}
              </p>
            </motion.div>
            </>
          )}

          {/* Transcript — fixed height, only this box scrolls */}
          <div className="flex-1 min-h-0 rounded-3xl bg-slate-900/50 border border-white/10 p-6 flex flex-col overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-400" />
                Real-time Transcript
                {isConnected && (
                  <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" />
                )}
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
                    ? contextReady
                      ? "Full context loaded — interviewer follows company + role style."
                      : "Resume-based interview active."
                    : "VAPI agent is listening. Speak naturally — don't worry about being perfect."
                  : isConnecting
                    ? "Connecting to AI interviewer..."
                    : contextReady
                      ? "Context ready. Click Begin to start."
                      : resumeText || jobRole
                        ? "Generate context (optional but recommended), then click Begin."
                        : hasWorkflow
                          ? "Start a general interview, or add role / resume for personalization."
                          : "Select a job role or upload a resume to begin."}
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
