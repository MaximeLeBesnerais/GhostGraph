import React from 'react';
import { X, Network, BrainCircuit, ArrowRight, Layers } from 'lucide-react';

interface AboutOverlayProps {
  onClose: () => void;
}

const AboutOverlay: React.FC<AboutOverlayProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-[fadeIn_0.2s_ease-out]">
      <div 
        className="relative w-full max-w-5xl bg-ghost-950 border border-ghost-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-ghost-400 hover:text-white bg-black/20 hover:bg-ghost-800 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        {/* Left: Hero/Visual */}
        <div className="w-full md:w-2/5 bg-ghost-900 p-8 md:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r border-ghost-800 relative overflow-hidden group">
          {/* Animated Background Effect */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,_#3b82f610_0%,_transparent_50%)]"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-neon-purple/5 blur-[100px] rounded-full group-hover:bg-neon-purple/10 transition-colors duration-1000"></div>
          
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                <div className="w-4 h-4 bg-black rounded-full animate-pulse"></div>
            </div>
            <h2 className="text-4xl font-bold text-white tracking-tighter mb-2">GhostGraph</h2>
            <p className="text-ghost-400 font-mono text-xs uppercase tracking-widest">Architectural Intelligence</p>
          </div>

          <div className="relative z-10 space-y-6 mt-12 md:mt-0">
            <div className="flex items-center gap-4 text-ghost-300">
               <div className="p-2 bg-ghost-800 rounded-lg border border-ghost-700">
                 <Network size={20} className="text-neon-blue"/>
               </div>
               <div>
                 <div className="text-xs font-bold text-white uppercase tracking-wider">Directed Graph</div>
                 <div className="text-[10px] text-ghost-500">Deterministic structure</div>
               </div>
            </div>
             <div className="flex items-center gap-4 text-ghost-300">
               <div className="p-2 bg-ghost-800 rounded-lg border border-ghost-700">
                 <BrainCircuit size={20} className="text-neon-purple"/>
               </div>
               <div>
                 <div className="text-xs font-bold text-white uppercase tracking-wider">LLM Reasoning</div>
                 <div className="text-[10px] text-ghost-500">Context-aware refinement</div>
               </div>
            </div>
             <div className="flex items-center gap-4 text-ghost-300">
               <div className="p-2 bg-ghost-800 rounded-lg border border-ghost-700">
                 <Layers size={20} className="text-emerald-400"/>
               </div>
               <div>
                 <div className="text-xs font-bold text-white uppercase tracking-wider">Separation of Concerns</div>
                 <div className="text-[10px] text-ghost-500">Modular by default</div>
               </div>
            </div>
          </div>
        </div>

        {/* Right: Content */}
        <div className="w-full md:w-3/5 p-8 md:p-12 overflow-y-auto bg-ghost-950/50">
          
          <div className="space-y-8">
            
            <section>
              <h3 className="text-xl font-bold text-white mb-3">The "Just Start Coding" Trap</h3>
              <p className="text-sm text-ghost-300 leading-relaxed">
                Modern tools—especially AI—have removed the friction between <span className="text-white font-medium">ideation</span> and <span className="text-white font-medium">implementation</span>. 
                This is a double-edged sword. When you bypass the planning phase, you incur "architectural debt" instantly. 
                Codebases become tangled webs of circular dependencies, unoptimized data flows, and monolithic logic blocks 
                before a single feature is shipped.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3">Blueprint First. Code Second.</h3>
              <p className="text-sm text-ghost-300 leading-relaxed">
                GhostGraph enforces a <span className="text-neon-blue font-medium">Schema-First</span> approach to software generation. 
                We treat your project as a directed graph of nodes (files) and edges (dependencies). 
                By refining this map <em>before</em> generating implementation details, we ensure:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-ghost-400">
                <li className="flex items-start gap-2">
                  <span className="text-neon-purple mt-1">●</span> Valid dependency chains (no circular imports)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neon-purple mt-1">●</span> Logical separation of services and UI
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neon-purple mt-1">●</span> A codebase that is documented by definition
                </li>
              </ul>
            </section>

            <div className="bg-ghost-900 border border-ghost-800 p-4 rounded-lg">
              <p className="text-xs text-ghost-400 italic">
                "An hour of planning can save you 10 hours of doing." — Dale Carnegie
                <br/>
                "An hour of GhostGraph can save you 100 hours of refactoring." — The AI
              </p>
            </div>

            <div className="pt-2">
              <button 
                onClick={onClose} 
                className="group flex items-center gap-2 text-white font-bold text-sm bg-ghost-800 hover:bg-neon-blue/20 hover:text-neon-blue px-4 py-2 rounded-lg transition-all border border-ghost-700 hover:border-neon-blue"
              >
                Enter the Architect <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform"/>
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default AboutOverlay;