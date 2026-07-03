import React from "react";

export default function ServicesLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 animate-pulse">
      {/* Fake Header skeleton */}
      <div className="h-16 border-b border-slate-900 bg-slate-900/10"></div>
      
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Left Sidebar Skeleton */}
          <div className="hidden md:block w-64 h-[400px] bg-slate-900/20 rounded-2xl border border-slate-800"></div>

          {/* Central Workspace Skeleton */}
          <div className="flex-1 space-y-6">
            <div className="h-32 bg-slate-900/20 rounded-2xl border border-slate-800"></div>
            
            {/* Grid list of services skeletons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 border border-slate-800 bg-slate-900/10 rounded-2xl p-5 space-y-4">
                  <div className="h-40 bg-slate-900/30 rounded-xl"></div>
                  <div className="h-4 bg-slate-900/30 w-3/4 rounded"></div>
                  <div className="h-3 bg-slate-900/30 w-1/2 rounded"></div>
                  <div className="h-10 bg-slate-900/30 rounded-lg"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
