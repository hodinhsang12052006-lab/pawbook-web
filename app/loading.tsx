import React from "react";

export default function HomeLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 animate-pulse">
      {/* Header Loading */}
      <div className="h-16 border-b border-slate-900 bg-slate-900/10"></div>
      
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Sidebar Loading */}
          <div className="hidden md:block w-64 h-[400px] bg-slate-900/20 rounded-2xl border border-slate-800"></div>

          {/* Feed/Jobs Skeletons */}
          <div className="flex-1 space-y-6">
            <div className="h-32 bg-slate-900/20 rounded-2xl border border-slate-800"></div>
            
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-28 border border-slate-800 bg-slate-900/10 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-slate-900/30 rounded-xl"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-slate-900/30 w-1/3 rounded"></div>
                      <div className="h-3 bg-slate-900/30 w-1/4 rounded"></div>
                    </div>
                  </div>
                  <div className="h-3 bg-slate-900/30 w-3/4 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
