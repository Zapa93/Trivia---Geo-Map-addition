import React from 'react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950">
      <div className="glass-panel p-12 rounded-3xl flex flex-col items-center relative overflow-hidden">
        
        <div className="relative">
          <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-magic-cyan mb-8"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">✨</span>
          </div>
        </div>
        
        <h2 className="text-4xl font-black tracking-wider text-white">
          SUMMONING...
        </h2>
        <p className="mt-4 text-purple-200 uppercase tracking-widest text-sm font-semibold">Gathering wisdom</p>
      </div>
    </div>
  );
};