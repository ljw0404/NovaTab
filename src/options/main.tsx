import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/globals.css';

function Options() {
  return (
    <div className="min-h-screen bg-neutral-950 px-8 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-3xl font-light">NovaTab · 星启页</h1>
        <p className="mb-8 text-sm text-white/55">Settings · v0.1</p>
        <div className="glass-strong rounded-2xl p-6">
          <p className="text-sm text-white/70">
            Settings UI is under construction. Search engine, theme, language,
            and Speed Dial import/export will live here.
          </p>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
