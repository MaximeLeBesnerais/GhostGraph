import React from 'react';
import { X, Network, BrainCircuit, ArrowRight, Layers } from 'lucide-react';

interface AboutOverlayProps {
  onClose: () => void;
}

const AboutOverlay: React.FC<AboutOverlayProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-[fadeIn_0.2s_ease-out]">
      <div 
        className="relative w-full max-w-6xl bg-ghost-950 border border-ghost-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-20 p-2 text-ghost-400 hover:text-white bg-black/20 hover:bg-ghost-800 rounded-full transition-colors"
        >
          <X size={24} />
        </button>

        {/* Left: Hero/Visual */}
        <div className="w-full md:w-2/5 bg-ghost-900 p-10 md:p-14 flex flex-col justify-between border-b md:border-b-0 md:border-r border-ghost-800 relative overflow-hidden group">
          {/* Animated Background Effect */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,_#3b82f610_0%,_transparent_50%)]"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-neon-purple/5 blur-[100px] rounded-full group-hover:bg-neon-purple/10 transition-colors duration-1000"></div>
          
          <div className="relative z-10">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                <div className="w-5 h-5 bg-black rounded-full animate-pulse"></div>
            </div>
            <h2 className="text-5xl font-bold text-white tracking-tighter mb-3">GhostGraph</h2>
            <p className="text-ghost-400 font-mono text-sm uppercase tracking-widest">Architectural Intelligence</p>
          </div>

          <div className="relative z-10 space-y-8 mt-12 md:mt-0">
            <div className="flex items-center gap-5 text-ghost-300">
               <div className="p-3 bg-ghost-800 rounded-xl border border-ghost-700">
                 <Network size={24} className="text-neon-blue"/>
               </div>
               <div>
                 <div className="text-sm font-bold text-white uppercase tracking-wider">Directed Graph</div>
                 <div className="text-xs text-ghost-500">Deterministic structure</div>
               </div>
            </div>
             <div className="flex items-center gap-5 text-ghost-300">
               <div className="p-3 bg-ghost-800 rounded-xl border border-ghost-700">
                 <BrainCircuit size={24} className="text-neon-purple"/>
               </div>
               <div>
                 <div className="text-sm font-bold text-white uppercase tracking-wider">LLM Reasoning</div>
                 <div className="text-xs text-ghost-500">Context-aware refinement</div>
               </div>
            </div>
             <div className="flex items-center gap-5 text-ghost-300">
               <div className="p-3 bg-ghost-800 rounded-xl border border-ghost-700">
                 <Layers size={24} className="text-emerald-400"/>
               </div>
               <div>
                 <div className="text-sm font-bold text-white uppercase tracking-wider">Separation of Concerns</div>
                 <div className="text-xs text-ghost-500">Modular by default</div>
               </div>
            </div>
          </div>
        </div>

        {/* Right: Content */}
        <div className="w-full md:w-3/5 p-10 md:p-14 overflow-y-auto bg-ghost-950/50">
          
          <div className="space-y-10">
            
            <section>
              <h3 className="text-2xl font-bold text-white mb-4">The "Just Start Coding" Trap</h3>
              <p className="text-base text-ghost-300 leading-relaxed">
                Modern tools—especially AI—have removed the friction between <span className="text-white font-medium">ideation</span> and <span className="text-white font-medium">implementation</span>. 
                This is a double-edged sword. When you bypass the planning phase, you incur "architectural debt" instantly. 
                Codebases become tangled webs of circular dependencies, unoptimized data flows, and monolithic logic blocks 
                before a single feature is shipped.
              </p>
            </section>

            <section>
              <h3 className="text-2xl font-bold text-white mb-4">Blueprint First. Code Second.</h3>
              <p className="text-base text-ghost-300 leading-relaxed">
                GhostGraph enforces a <span className="text-neon-blue font-medium">Schema-First</span> approach to software generation. 
                We treat your project as a directed graph of nodes (files) and edges (dependencies). 
                By refining this map <em>before</em> generating implementation details, we ensure:
              </p>
              <ul className="mt-4 space-y-3 text-base text-ghost-400">
                <li className="flex items-start gap-3">
                  <span className="text-neon-purple mt-1.5">●</span> Valid dependency chains (no circular imports)
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-neon-purple mt-1.5">●</span> Logical separation of services and UI
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-neon-purple mt-1.5">●</span> A codebase that is documented by definition
                </li>
              </ul>
            </section>

            <div className="bg-ghost-900 border border-ghost-800 p-6 rounded-xl">
              <p className="text-sm text-ghost-400 italic leading-relaxed">
                "An hour of planning can save you 10 hours of doing." — Dale Carnegie
                <br className="mb-2"/>
                "An hour of GhostGraph can save you 100 hours of refactoring." — The AI
              </p>
            </div>

            <div className="pt-2">
              <button 
                onClick={onClose} 
                className="group flex items-center gap-3 text-white font-bold text-base bg-ghost-800 hover:bg-neon-blue/20 hover:text-neon-blue px-6 py-3 rounded-xl transition-all border border-ghost-700 hover:border-neon-blue"
              >
                Enter the Architect <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default AboutOverlay;