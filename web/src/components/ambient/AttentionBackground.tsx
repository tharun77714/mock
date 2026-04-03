'use client';

export default function AttentionBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="enterprise-base absolute inset-0" />
      <div className="enterprise-aurora absolute inset-0" />
      <div className="enterprise-grid absolute inset-0" />
      <div className="enterprise-vignette absolute inset-0" />
      <div className="noise-layer absolute inset-0 opacity-20" />
    </div>
  );
}
