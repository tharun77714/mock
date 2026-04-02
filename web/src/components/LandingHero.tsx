'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useInView, useSpring } from 'framer-motion';
import { Button } from './ui/Button';
import { signIn } from 'next-auth/react';
import { Sparkles, Video, Mic, Award, Brain, Eye, Activity, ChevronDown } from 'lucide-react';

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let mouse = { x: 0, y: 0 };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number; hue: number }[] = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        hue: Math.random() * 60 + 220,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          p.vx += dx * 0.00005;
          p.vy += dy * 0.00005;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.vy *= 0.99;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.opacity})`;
        ctx.fill();

        particles.forEach((p2, j) => {
          if (j <= i) return;
          const d = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `hsla(240, 60%, 60%, ${0.1 * (1 - d / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationId = requestAnimationFrame(animate);
    };

    const handleMouse = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouse);
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 -z-10" />;
}

function MagneticButton({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.3;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.3;
    setPosition({ x, y });
  };

  return (
    <motion.button
      ref={ref}
      className={className}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15 }}
      onMouseMove={handleMouse}
      onMouseLeave={() => setPosition({ x: 0, y: 0 })}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}

function AnimatedCounter({ target, duration = 2 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return <span ref={ref}>{count}</span>;
}

function FloatingOrb({ delay, x, y, size, color }: { delay: number; x: string; y: string; size: string; color: string }) {
  return (
    <motion.div
      className={`absolute rounded-full ${color} blur-[80px] -z-10`}
      style={{ left: x, top: y, width: size, height: size }}
      animate={{
        x: [0, 30, -20, 0],
        y: [0, -40, 20, 0],
        scale: [1, 1.2, 0.9, 1],
      }}
      transition={{ duration: 8, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

const features = [
  { icon: Mic, title: 'AI Voice Interview', desc: 'Natural voice conversation powered by VAPI AI for hyper-realistic mock interviews.', gradient: 'from-violet-500 to-indigo-500' },
  { icon: Brain, title: 'DeepFace CNN Analysis', desc: 'Real deep learning model analyzes your facial expressions frame-by-frame for confidence.', gradient: 'from-indigo-500 to-blue-500' },
  { icon: Eye, title: 'Eye Contact Tracking', desc: 'Computer vision tracks face position and stability to measure your eye contact quality.', gradient: 'from-blue-500 to-cyan-500' },
  { icon: Activity, title: 'Body Language Score', desc: 'Head stability, posture analysis, and movement tracking for professional presence.', gradient: 'from-cyan-500 to-emerald-500' },
  { icon: Video, title: 'Video Recording', desc: 'Full session recording with playback so you can review your performance.', gradient: 'from-emerald-500 to-green-500' },
  { icon: Award, title: 'Smart Suggestions', desc: 'Filler word detection, speaking pace analysis, and personalized improvement tips.', gradient: 'from-amber-500 to-orange-500' },
];

const stats = [
  { value: 95, suffix: '%', label: 'Accuracy' },
  { value: 7, suffix: '+', label: 'AI Metrics' },
  { value: 30, suffix: 'fps', label: 'Analysis Speed' },
  { value: 6, suffix: '', label: 'DL Features' },
];

export const LandingHero = () => {
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const featuresInView = useInView(featuresRef, { once: true, margin: "-100px" });
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  return (
    <div className="relative overflow-hidden">
      <ParticleCanvas />

      {/* Morphing gradient orbs */}
      <FloatingOrb delay={0} x="10%" y="20%" size="400px" color="bg-indigo-600/20" />
      <FloatingOrb delay={2} x="70%" y="10%" size="350px" color="bg-blue-600/15" />
      <FloatingOrb delay={4} x="50%" y="60%" size="300px" color="bg-violet-600/10" />

      {/* Hero Section */}
      <motion.section style={{ y, opacity }} className="relative flex flex-col items-center justify-center min-h-screen px-6 lg:px-8">
        
        {/* Shimmer badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="relative overflow-hidden rounded-full bg-indigo-500/10 px-4 py-1.5 text-sm font-semibold text-indigo-400 ring-1 ring-inset ring-indigo-500/20 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>AI-Powered Interview Intelligence</span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            />
          </div>
        </motion.div>

        {/* Main heading with stagger */}
        <motion.h1
          className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-center leading-[1.1]"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
        >
          {['Master', 'Your'].map((word, i) => (
            <motion.span
              key={i}
              className="text-white inline-block mr-4"
              variants={{
                hidden: { opacity: 0, y: 40, rotateX: -40 },
                visible: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
              }}
            >
              {word}
            </motion.span>
          ))}
          <br />
          <motion.span
            className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400 inline-block"
            variants={{
              hidden: { opacity: 0, y: 40, scale: 0.8 },
              visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] } },
            }}
          >
            Dream Interview
          </motion.span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-8 text-lg sm:text-xl leading-8 text-slate-400 max-w-2xl mx-auto text-center"
        >
          Real-time AI voice interviews with <span className="text-white font-semibold">DeepFace CNN</span> emotion analysis, 
          eye contact tracking, body language scoring, and personalized improvement suggestions.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-10 flex items-center justify-center gap-x-6"
        >
          <MagneticButton
            onClick={() => signIn('google')}
            className="relative px-8 py-4 rounded-2xl bg-indigo-600 text-white font-bold text-lg overflow-hidden group cursor-pointer"
          >
            <span className="relative z-10 flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Start Your Free Session
            </span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-600"
              initial={{ x: '-100%' }}
              whileHover={{ x: '0%' }}
              transition={{ duration: 0.3 }}
            />
          </MagneticButton>

          <a href="#features" className="text-sm font-semibold leading-6 text-slate-300 hover:text-white transition-colors group flex items-center gap-1">
            Learn how it works 
            <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>→</motion.span>
          </a>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-8 w-full max-w-3xl"
        >
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl font-bold text-white">
                <AnimatedCounter target={stat.value} />{stat.suffix}
              </p>
              <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 flex flex-col items-center gap-2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Scroll</span>
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </motion.div>
      </motion.section>

      {/* Features Section */}
      <section id="features" ref={featuresRef} className="relative py-32 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
              Powered by <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">Real Deep Learning</span>
            </h2>
            <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto">
              Not fake scores — actual CNN-based facial analysis, computer vision tracking, and NLP on every frame of your interview.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-sm overflow-hidden cursor-default"
              >
                {/* Hover glow */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${feature.gradient} blur-3xl`} style={{ opacity: 0.05 }} />
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.06), transparent 50%)' }}
                />

                <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-300 transition-all duration-300">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>

                {/* Bottom shine */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-32 px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl sm:text-5xl font-bold text-white text-center mb-20"
          >
            How It Works
          </motion.h2>

          <div className="space-y-0">
            {[
              { step: '01', title: 'Sign in with Google', desc: 'One-click authentication. No forms, no passwords.' },
              { step: '02', title: 'Start Mock Interview', desc: 'Our AI interviewer asks real interview questions via voice conversation.' },
              { step: '03', title: 'AI Analyzes Everything', desc: 'DeepFace CNN processes your expressions, OpenCV tracks your eyes and posture, NLP catches filler words.' },
              { step: '04', title: 'Get Your Report', desc: 'Detailed breakdown with scores, charts, suggestions, and your full labeled transcript.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6 }}
                className="flex items-start gap-8 py-12 border-b border-white/5 group"
              >
                <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-indigo-500/40 to-transparent shrink-0 group-hover:from-indigo-400 group-hover:to-indigo-600/40 transition-all duration-500">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors duration-300">{item.title}</h3>
                  <p className="mt-2 text-slate-400 text-lg">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/10 via-transparent to-transparent" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative mx-auto max-w-3xl text-center"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Ready to Ace Your Next Interview?
          </h2>
          <p className="text-lg text-slate-400 mb-10">
            Join thousands of professionals using AI-powered deep learning to master their interview skills.
          </p>
          <MagneticButton
            onClick={() => signIn('google')}
            className="px-10 py-5 rounded-2xl bg-indigo-600 text-white font-bold text-lg cursor-pointer hover:bg-indigo-500 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Get Started — It's Free
            </span>
          </MagneticButton>
        </motion.div>
      </section>
    </div>
  );
};
