import React, { useState, useEffect, useRef } from 'react';
import { AppPhase, ChatMessage, GraphData, NodeData, FileType } from './types';
import { 
  initArchitectChat, 
  sendMessageToArchitect, 
  generateProjectBlueprint, 
  initBlueprintChat, 
  askBlueprintQuestion,
  generateFileCode,
  generateUserProxyResponse
} from './services/geminiService';
import ArchitectChat from './components/ArchitectChat';
import GraphVisualizer from './components/GraphVisualizer';
import FileTree from './components/FileTree';
import AboutOverlay from './components/AboutOverlay';
import { Sparkles, ArrowRight, AlertCircle, Download, X, HelpCircle, Crosshair, Code2, CheckCircle, Info, Box, Layers, Zap, Terminal, FileText, RotateCcw, Wand2 } from 'lucide-react';
import JSZip from 'jszip';

const SURPRISE_PROMPTS = [
  "A minimalistic Pomodoro timer web app",
  "A CLI tool to fetch weather for a city",
  "A Markdown-to-HTML converter script",
  "A simple Expense Tracker using LocalStorage",
  "A random quote generator website",
  "A text-based adventure game engine",
  "A script to organize files in a folder by extension"
];

function App() {
  const [phase, setPhase] = useState<AppPhase>(AppPhase.INPUT);
  const [initialIdea, setInitialIdea] = useState("");
  const [language, setLanguage] = useState("Best fit for the project"); 
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [showAbout, setShowAbout] = useState(false);
  
  // UI State
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  
  // Blueprint Chat State
  const [showBlueprintChat, setShowBlueprintChat] = useState(false);
  const [blueprintMessages, setBlueprintMessages] = useState<ChatMessage[]>([]);
  const [blueprintInput, setBlueprintInput] = useState("");
  const [isBlueprintThinking, setIsBlueprintThinking] = useState(false);

  // MVP Generation State
  const [showMVPModal, setShowMVPModal] = useState(false);
  const [mvpProgress, setMvpProgress] = useState<{current: number, total: number, file: string} | null>(null);

  // Surprise / Auto-Pilot Mode
  const [isSurpriseMode, setIsSurpriseMode] = useState(false);

  // --- PERSISTENCE LOGIC ---
  const isLoadedRef = useRef(false);

  // Load from storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ghostgraph_state');
    if (saved && !isLoadedRef.current) {
      try {
        const parsed = JSON.parse(saved);
        setPhase(parsed.phase || AppPhase.INPUT);
        setInitialIdea(parsed.initialIdea || "");
        setMessages(parsed.messages || []);
        setGraphData(parsed.graphData || null);
        // Only re-init chats if we have data to support it, strictly we can't fully rehydrate the Chat object
        // but the messages array allows us to continue context mostly if we re-send history (not implemented here for simplicity,
        // we just restore visual state).
        // For Blueprint chat, we re-init if graph data exists
        if (parsed.graphData) {
            initBlueprintChat(parsed.graphData);
        }
      } catch (e) {
        console.error("Failed to load state", e);
      }
      isLoadedRef.current = true;
    }
  }, []);

  // Save to storage on change
  useEffect(() => {
    if (phase !== AppPhase.INPUT || initialIdea) {
        const stateToSave = {
            phase,
            initialIdea,
            messages,
            graphData,
        };
        try {
            localStorage.setItem('ghostgraph_state', JSON.stringify(stateToSave));
        } catch (e) {
            console.warn("State too large to save", e);
        }
    }
  }, [phase, initialIdea, messages, graphData]);

  const handleReset = () => {
      localStorage.removeItem('ghostgraph_state');
      window.location.reload();
  };

  // Sync selected node when graph data updates (e.g. after code gen)
  useEffect(() => {
    if (selectedNode && graphData) {
      const freshNode = graphData.nodes.find(n => n.id === selectedNode.id);
      if (freshNode && (freshNode.content !== selectedNode.content || freshNode !== selectedNode)) {
        setSelectedNode(freshNode);
      }
    }
  }, [graphData, selectedNode]);

  // Handle errors
  const handleApiError = (e: any) => {
    console.error(e);
    const msg = e.message || e.toString();
    if (msg.includes('429') || msg.includes('Quota') || msg.includes('403') || msg.includes('key')) {
      setIsQuotaError(true);
      setError("API Quota Limit Reached. Please select a valid API key.");
    } else {
      setError("An unexpected error occurred. Please try again.");
    }
    // Stop surprise mode on error so user can intervene
    setIsSurpriseMode(false);
  };

  const handleChangeApiKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
       try {
         await window.aistudio.openSelectKey();
         setError(null);
         setIsQuotaError(false);
       } catch (e) {
         console.error("Failed to open key selector", e);
       }
    } else {
      alert("API Key selection is not available in this environment.");
    }
  };

  // Phase Transitions
  const handleStartRefinement = async (ideaOverride?: string) => {
    const ideaToUse = ideaOverride || initialIdea;
    if (!ideaToUse.trim()) {
      setError("Please describe your project idea.");
      return;
    }
    setPhase(AppPhase.REFINEMENT);
    setIsLoading(true);
    setError(null);
    setIsQuotaError(false);
    try {
      initArchitectChat();
      // Only send the idea, let the architect ask about the stack
      const userMsg: ChatMessage = { role: 'user', text: ideaToUse };
      setMessages([userMsg]);
      const response = await sendMessageToArchitect(ideaToUse);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) {
      handleApiError(e);
      setPhase(AppPhase.INPUT);
    } finally {
      setIsLoading(false);
    }
  };

  // Surprise Me Logic
  const handleSurpriseMe = () => {
      const randomIdea = SURPRISE_PROMPTS[Math.floor(Math.random() * SURPRISE_PROMPTS.length)];
      setInitialIdea(randomIdea);
      setIsSurpriseMode(true);
      handleStartRefinement(randomIdea);
  };

  // Auto-Pilot for Surprise Mode
  useEffect(() => {
    if (!isSurpriseMode || isLoading || phase !== AppPhase.REFINEMENT) return;

    const lastMsg = messages[messages.length - 1];
    
    // If the last message is from the model (Architect), we need to answer it
    if (lastMsg?.role === 'model') {
        const timeoutId = setTimeout(async () => {
            try {
                // Parse to check completion
                let isComplete = false;
                let questions = "";
                try {
                    const parsed = JSON.parse(lastMsg.text.replace(/```json/g, '').replace(/```/g, '').trim());
                    isComplete = parsed.isComplete;
                    questions = parsed.questions?.join("\n") || "";
                } catch {
                    // Fallback if not JSON
                }

                if (isComplete) {
                    // Auto-trigger blueprint generation
                    handleGenerateBlueprint("Create a minimal, clean implementation.");
                } else {
                    // Generate Auto Answer
                    setIsLoading(true); // Artificial loading state for UX
                    const autoResponse = await generateUserProxyResponse(questions, initialIdea);
                    handleSendMessage(autoResponse);
                }
            } catch (e) {
                console.error("Auto pilot error", e);
                setIsSurpriseMode(false); // Stop auto pilot on error
            }
        }, 1500); // Small delay for UX so user sees the question arrive

        return () => clearTimeout(timeoutId);
    }
  }, [messages, isSurpriseMode, isLoading, phase, initialIdea]);


  const handleSendMessage = async (text: string) => {
    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsLoading(true);
    try {
      const response = await sendMessageToArchitect(text);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) {
      handleApiError(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateBlueprint = async (finalComment?: string) => {
    setPhase(AppPhase.GENERATING);
    // Exit surprise mode once we hit generation
    setIsSurpriseMode(false);
    try {
      const context = messages.map(m => `${m.role}: ${m.text}`).join('\n');
      const data = await generateProjectBlueprint(context, language, finalComment);
      
      // SANITIZE GRAPH DATA: Ensure all links point to existing nodes
      const nodeIds = new Set(data.nodes.map(n => n.id));
      const validLinks = data.links.filter(link => {
        const sourceExists = nodeIds.has(link.source);
        const targetExists = nodeIds.has(link.target);
        if (!sourceExists || !targetExists) {
          console.warn(`Dropping invalid link: ${link.source} -> ${link.target}`);
        }
        return sourceExists && targetExists;
      });

      const sanitizedData = { ...data, links: validLinks };

      setGraphData(sanitizedData);
      initBlueprintChat(sanitizedData);
      setPhase(AppPhase.VISUALIZATION);
    } catch (e) {
      handleApiError(e);
      setPhase(AppPhase.REFINEMENT);
    }
  };

  const handleGenerateMVP = async () => {
    if (!graphData) return;
    setShowMVPModal(false);
    
    const filesToGenerate = graphData.nodes.filter(n => n.type === FileType.FILE);
    setMvpProgress({ current: 0, total: filesToGenerate.length, file: "Starting..." });

    try {
      const updatedNodes = [...graphData.nodes];
      for (let i = 0; i < filesToGenerate.length; i++) {
        const node = filesToGenerate[i];
        setMvpProgress({ current: i + 1, total: filesToGenerate.length, file: node.name });
        
        const dependencies = graphData.links
          .filter(l => l.source === node.id || l.target === node.id)
          .map(l => {
             const otherId = l.source === node.id ? l.target : l.source;
             const otherNode = graphData.nodes.find(n => n.id === otherId);
             return otherNode ? `${otherNode.name} (${otherNode.description})` : "";
          })
          .filter(Boolean);

        const code = await generateFileCode(node, initialIdea, dependencies);
        const nodeIndex = updatedNodes.findIndex(n => n.id === node.id);
        if (nodeIndex !== -1) {
          updatedNodes[nodeIndex] = { ...updatedNodes[nodeIndex], content: code };
        }
      }
      setGraphData({ ...graphData, nodes: updatedNodes });
      setNotification("MVP Generated. Project ready for export.");
      setTimeout(() => setNotification(null), 8000);
    } catch (e) {
      handleApiError(e);
    } finally {
      setMvpProgress(null);
    }
  };

  const handleExportZip = async () => {
    if (!graphData) return;
    const zip = new JSZip();
    const nodeMap = new Map<string, NodeData>(graphData.nodes.map(n => [n.id, n]));
    
    const getPath = (nodeId: string): string => {
      const node = nodeMap.get(nodeId);
      if (!node) return "";
      const parentPath = node.parentId ? getPath(node.parentId) : "";
      return parentPath ? `${parentPath}/${node.name}` : node.name;
    };

    let treeString = "";
    const buildTreeString = (parentId: string | null | undefined, depth: number) => {
       const children = graphData.nodes.filter(n => n.parentId == parentId);
       children.forEach((node, index) => {
          const isLast = index === children.length - 1;
          const prefix = "  ".repeat(depth) + (isLast ? "└── " : "├── ");
          treeString += `${prefix}${node.name}\n`;
          buildTreeString(node.id, depth + 1);
       });
    };
    buildTreeString(null, 0);

    const readmeContent = `# ${initialIdea}\n\nGenerated by **GhostGraph**\nStack: ${language}\n\n## Structure\n\`\`\`text\n${treeString}\`\`\`\n`;
    zip.file("README.md", readmeContent);

    graphData.nodes.forEach(node => {
      const path = getPath(node.id);
      if (node.type === FileType.FOLDER || node.type === FileType.SERVICE) {
        zip.folder(path);
      } else {
        const content = node.content || `// TODO: Implement ${node.name}\n// ${node.description}`;
        zip.file(path, content);
      }
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ghostgraph-project.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Blueprint Chat
  const handleBlueprintAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blueprintInput.trim() || isBlueprintThinking) return;
    const msg = blueprintInput;
    setBlueprintInput("");
    setBlueprintMessages(prev => [...prev, { role: 'user', text: msg }]);
    setIsBlueprintThinking(true);
    try {
      const response = await askBlueprintQuestion(msg);
      setBlueprintMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) {
      setBlueprintMessages(prev => [...prev, { role: 'model', text: "Error fetching answer." }]);
    } finally {
      setIsBlueprintThinking(false);
    }
  };

  const handleDownloadSingleFile = (node: NodeData) => {
    if (!node.content) return;
    const blob = new Blob([node.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = node.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- RENDER HELPERS ---

  return (
    <div className="flex flex-col h-screen w-full font-sans selection:bg-neon-purple selection:text-white overflow-hidden">
      
      {/* Background Elements */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-neon-purple/5 blur-[120px] pointer-events-none mix-blend-screen z-0"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-neon-blue/5 blur-[100px] pointer-events-none mix-blend-screen z-0"></div>

      {/* Standard Header */}
      <header className="shrink-0 w-full h-16 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
          </div>
          <span className="font-bold text-lg tracking-tight text-white">GhostGraph</span>
          <span className="text-xs text-ghost-400 font-mono border-l border-ghost-700 pl-3 pt-0.5">v1.0</span>
          
          {phase !== AppPhase.INPUT && (
            <button 
                onClick={handleReset}
                className="ml-4 p-1.5 rounded-lg text-ghost-500 hover:text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2 group"
                title="Reset Project (Clears Data)"
            >
                <RotateCcw size={14} className="group-hover:-rotate-180 transition-transform duration-500" />
                <span className="text-xs font-mono">NEW</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAbout(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-ghost-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <Info size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative w-full overflow-hidden">
        
        {showAbout && <AboutOverlay onClose={() => setShowAbout(false)} />}

        {/* --- VIEW: INPUT --- */}
        {phase === AppPhase.INPUT && (
          <div className="w-full h-full flex flex-col md:flex-row relative z-10 overflow-auto">
            {/* Left: Typography */}
            <div className="w-full md:w-1/2 min-h-full flex flex-col justify-center px-8 md:px-20 py-12 relative">
               <div className="absolute top-1/2 left-0 w-px h-64 bg-gradient-to-b from-transparent via-ghost-700 to-transparent hidden md:block"></div>
               <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter text-white mb-8 leading-[0.9]">
                 Code <br/> 
                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-ghost-400 to-ghost-600">Unseen.</span>
               </h1>
               <p className="text-xl text-ghost-400 max-w-xl leading-relaxed font-light">
                  Abandon the "code-first" chaos. GhostGraph acts as your proactive system architect, transforming vague concepts into rigorous, dependency-validated blueprints. Visualize your entire stack, refine complex data flows, and forge a production-ready MVP foundation before a single line of code is written.
               </p>
               
               <div className="mt-16 flex gap-12">
                 <div className="flex flex-col gap-2">
                   <span className="text-3xl font-bold text-white">01</span>
                   <span className="text-sm uppercase tracking-widest text-ghost-500">Ideate</span>
                 </div>
                 <div className="flex flex-col gap-2">
                   <span className="text-3xl font-bold text-ghost-600">02</span>
                   <span className="text-sm uppercase tracking-widest text-ghost-700">Refine</span>
                 </div>
                 <div className="flex flex-col gap-2">
                   <span className="text-3xl font-bold text-ghost-600">03</span>
                   <span className="text-sm uppercase tracking-widest text-ghost-700">Visualize</span>
                 </div>
               </div>
            </div>

            {/* Right: Interaction */}
            <div className="w-full md:w-1/2 min-h-full flex items-center justify-center p-8 bg-gradient-to-l from-black via-transparent to-transparent">
              <div className="w-full max-w-lg glass-panel p-10 rounded-3xl relative overflow-hidden group">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-blue to-neon-purple transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                 
                 <div className="space-y-8">
                   <div className="space-y-3">
                     <label className="text-sm font-mono text-neon-blue mb-1 block">PROJECT_MANIFEST.init()</label>
                     <textarea 
                       value={initialIdea} 
                       onChange={(e) => setInitialIdea(e.target.value)}
                       placeholder="Describe your vision..."
                       className="w-full h-40 bg-black/40 text-white placeholder-ghost-600 p-6 rounded-xl border border-ghost-800 focus:border-neon-blue focus:outline-none resize-none transition-colors text-xl leading-relaxed"
                     />
                   </div>
                   
                   <div className="flex gap-3">
                       <button 
                          onClick={() => handleStartRefinement()}
                          disabled={!initialIdea.trim() || isLoading}
                          className="flex-1 group/btn relative overflow-hidden rounded-xl bg-white text-black font-bold py-5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-lg"
                        >
                          <span className="relative z-10 flex items-center justify-center gap-3">
                            {isLoading ? 'INITIALIZING...' : 'START ARCHITECT'} <ArrowRight size={20} />
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                       </button>

                       <button 
                          onClick={handleSurpriseMe}
                          disabled={isLoading}
                          className="px-5 rounded-xl bg-white/5 border border-white/10 text-ghost-300 hover:text-neon-purple hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-1 group/rnd"
                          title="Surprise Me (Auto-Pilot)"
                       >
                          <Wand2 size={20} className="group-hover/rnd:rotate-12 transition-transform" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Auto</span>
                       </button>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: REFINEMENT --- */}
        {phase === AppPhase.REFINEMENT && (
          <div className="w-full h-full flex items-center justify-center p-6 relative z-10">
            {/* Constrained container centered in the remaining space */}
            <div className="w-full max-w-4xl h-full max-h-[1000px] glass-panel rounded-[32px] overflow-hidden shadow-2xl flex flex-col relative border border-white/5">
               {isSurpriseMode && (
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-cyan to-neon-purple animate-[shimmer_1s_infinite] z-20"></div>
               )}
               <ArchitectChat 
                 messages={messages} 
                 onSendMessage={handleSendMessage}
                 onGenerate={handleGenerateBlueprint}
                 isLoading={isLoading}
               />
               {isSurpriseMode && (
                   <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-neon-purple/30 flex items-center gap-2 text-xs font-mono text-neon-purple shadow-lg z-20">
                       <Sparkles size={12} className="animate-spin" />
                       AUTO-PILOT ACTIVE
                   </div>
               )}
            </div>
          </div>
        )}

        {/* --- VIEW: GENERATING --- */}
        {phase === AppPhase.GENERATING && (
          <div className="w-full h-full flex flex-col items-center justify-center relative z-10">
             <div className="relative">
                <div className="absolute inset-0 bg-neon-purple/20 blur-3xl rounded-full"></div>
                <div className="w-32 h-32 border-t-2 border-b-2 border-white rounded-full animate-spin relative z-10"></div>
                <div className="w-20 h-20 border-l-2 border-r-2 border-neon-blue rounded-full animate-spin absolute top-6 left-6 z-10 [animation-direction:reverse]"></div>
             </div>
             <h2 className="mt-10 text-3xl font-bold text-white tracking-widest uppercase">Synthesizing Blueprint</h2>
             <p className="text-ghost-400 font-mono text-sm mt-3">Resolving dependencies...</p>
          </div>
        )}

        {/* --- VIEW: VISUALIZATION --- */}
        {phase === AppPhase.VISUALIZATION && graphData && (
          <div className="relative w-full h-full bg-black">
             {/* The Graph is the Background Layer */}
             <div className="absolute inset-0 z-0">
               <GraphVisualizer 
                 data={graphData} 
                 onNodeSelect={(n) => { setSelectedNode(n); setIsRightPanelOpen(true); }}
                 selectedNodeId={selectedNode?.id}
                 focusTrigger={focusTrigger}
               />
             </div>
             
             {/* Floating Bottom Dock (Action Bar) */}
             <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-[slideUp_0.4s_ease-out]">
                <div className="glass-panel rounded-full p-2 flex items-center gap-1 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
                   {!mvpProgress && (
                    <button 
                      onClick={() => setShowMVPModal(true)}
                      className="group flex items-center gap-2 px-5 py-3 rounded-full hover:bg-white/10 text-ghost-300 hover:text-white transition-all"
                    >
                      <Code2 size={20} />
                      <span className="font-bold text-sm">Generate MVP</span>
                    </button>
                   )}
                   
                   <div className="w-px h-6 bg-white/10 mx-1"></div>
                   
                   <button 
                      onClick={handleExportZip}
                      className="group p-3 hover:bg-white/10 rounded-full text-ghost-300 hover:text-white transition-colors relative"
                      title="Export ZIP"
                    >
                      <Download size={20} />
                      <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Export</span>
                    </button>
                   
                   <button 
                      onClick={() => setShowBlueprintChat(!showBlueprintChat)}
                      className={`p-3 rounded-full transition-colors relative ${showBlueprintChat ? 'bg-neon-purple text-white shadow-[0_0_15px_rgba(139,92,246,0.5)]' : 'hover:bg-white/10 text-ghost-300 hover:text-white'}`}
                      title="Chat with Architect"
                    >
                      <HelpCircle size={20} />
                    </button>
                </div>
             </div>

             {/* Floating Left Panel: File Tree */}
             <div 
               className={`absolute top-8 left-6 bottom-8 w-80 z-20 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${isLeftPanelOpen ? 'translate-x-0' : '-translate-x-[120%]'}`}
             >
                <div className="w-full h-full glass-panel-dark rounded-2xl flex flex-col overflow-hidden border border-white/5 shadow-2xl">
                   <div className="shrink-0 p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                      <span className="text-xs font-bold text-ghost-400 uppercase tracking-wider flex items-center gap-2">
                        <Box size={14}/> Architecture
                      </span>
                      <button onClick={() => setIsLeftPanelOpen(false)} className="text-ghost-500 hover:text-white md:hidden"><X size={14}/></button>
                   </div>
                   <div className="flex-1 overflow-hidden min-h-0 relative">
                      <FileTree 
                        nodes={graphData.nodes} 
                        onSelect={(n) => { setSelectedNode(n); setIsRightPanelOpen(true); }}
                        selectedId={selectedNode?.id}
                      />
                   </div>
                </div>
             </div>
             
             {/* Toggle Left */}
             {!isLeftPanelOpen && (
               <button 
                 onClick={() => setIsLeftPanelOpen(true)}
                 className="absolute top-8 left-6 z-20 p-3 glass-panel rounded-xl text-ghost-400 hover:text-white"
               >
                 <Layers size={20} />
               </button>
             )}

             {/* Floating Right Panel: Details */}
             <div 
               className={`absolute top-8 right-6 w-[400px] max-h-[calc(100%-4rem)] z-20 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${selectedNode && isRightPanelOpen ? 'translate-x-0' : 'translate-x-[150%]'}`}
             >
                <div className="w-full glass-panel-dark rounded-2xl flex flex-col overflow-hidden border border-white/5 shadow-2xl">
                   {selectedNode && (
                     <>
                       {/* Redesigned Header to match screenshot */}
                       <div className="p-6 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent">
                          <div className="flex justify-between items-start mb-4">
                             <div>
                                <h2 className="text-2xl font-bold text-white font-mono break-all leading-tight">{selectedNode.name}</h2>
                                <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-white/10 text-ghost-300 border border-white/10">
                                   {selectedNode.type}
                                </span>
                             </div>
                             
                             {/* Action Toolbar */}
                             <div className="flex gap-1">
                                <button title="View Code" onClick={() => {}} className="p-2 hover:bg-white/10 rounded-lg text-ghost-400 hover:text-white transition-colors">
                                  <Code2 size={16} />
                                </button>
                                <button title="Download" onClick={() => handleDownloadSingleFile(selectedNode)} className="p-2 hover:bg-white/10 rounded-lg text-ghost-400 hover:text-white transition-colors">
                                  <Download size={16} />
                                </button>
                                <button title="Details" className="p-2 hover:bg-white/10 rounded-lg text-ghost-400 hover:text-white transition-colors">
                                  <HelpCircle size={16} />
                                </button>
                                <div className="w-px h-6 bg-white/10 mx-1 self-center"></div>
                                <button onClick={() => setIsRightPanelOpen(false)} className="p-2 hover:bg-red-500/20 rounded-lg text-ghost-500 hover:text-red-400 transition-colors">
                                  <X size={16}/>
                                </button>
                             </div>
                          </div>
                       </div>
                       
                       <div className="p-6 overflow-y-auto max-h-[60vh] md:max-h-[70vh] space-y-8">
                          
                          {/* Purpose Section */}
                          <div>
                             <label className="text-[10px] uppercase font-bold text-ghost-500 tracking-widest mb-2 block">Purpose</label>
                             <p className="text-sm text-ghost-200 leading-relaxed font-light">{selectedNode.description || "No description provided."}</p>
                          </div>
                          
                          {/* Stack Section */}
                          {selectedNode.techStack && (
                            <div>
                              <label className="text-[10px] uppercase font-bold text-ghost-500 tracking-widest mb-2 block">Stack</label>
                              <div className="flex flex-wrap gap-2">
                                 {selectedNode.techStack.map(t => (
                                   <span key={t} className="text-xs px-2.5 py-1 rounded bg-neon-blue/10 text-neon-blue border border-neon-blue/20">{t}</span>
                                 ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Implementation Section */}
                          {selectedNode.type === FileType.FILE && (
                             <div className="border-t border-white/5 pt-6">
                                <div className="flex justify-between items-center mb-3">
                                   <label className="text-[10px] uppercase font-bold text-ghost-500 tracking-widest block">Implementation</label>
                                   {selectedNode.content && (
                                     <span className="flex items-center gap-1.5 text-[10px] text-green-400 font-bold uppercase tracking-wider bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                                       <CheckCircle size={10} /> Generated
                                     </span>
                                   )}
                                </div>
                                
                                <div className="relative group">
                                   {selectedNode.content ? (
                                     <div className="bg-black border border-white/10 rounded-xl p-4 overflow-auto max-h-60 scrollbar-thin">
                                        <pre className="text-[10px] font-mono text-ghost-300 leading-normal">{selectedNode.content}</pre>
                                     </div>
                                   ) : (
                                     <div className="h-32 border border-dashed border-white/10 rounded-xl flex items-center justify-center text-xs text-ghost-500 bg-white/5 font-mono">
                                        Awaiting Implementation
                                     </div>
                                   )}
                                   
                                   {/* Generate MVP Prompt if empty */}
                                   {!selectedNode.content && !mvpProgress && (
                                      <div className="mt-3 text-[10px] text-center text-ghost-500">
                                         Use "Generate MVP" to populate this file.
                                      </div>
                                   )}
                                </div>
                             </div>
                          )}
                          
                          <button 
                             onClick={() => setFocusTrigger(Date.now())}
                             className="w-full py-3 border border-white/10 rounded-lg hover:bg-white/5 text-xs font-bold uppercase tracking-wider text-ghost-300 transition-colors flex items-center justify-center gap-2"
                          >
                             <Crosshair size={14}/> Center Graph
                          </button>
                       </div>
                     </>
                   )}
                </div>
             </div>

             {/* Blueprint Chat Floating Bubble */}
             {showBlueprintChat && (
                <div className="absolute bottom-6 right-6 w-96 h-[500px] z-30 animate-[float_0.3s_ease-out]">
                   <div className="w-full h-full glass-panel-dark rounded-2xl flex flex-col overflow-hidden border border-neon-purple/30 shadow-[0_0_40px_-10px_rgba(139,92,246,0.2)]">
                      <div className="p-4 bg-neon-purple/10 border-b border-neon-purple/20 flex justify-between items-center">
                         <span className="text-sm font-bold text-neon-purple flex items-center gap-2">
                           <Sparkles size={16}/> Architect Intelligence
                         </span>
                         <button onClick={() => setShowBlueprintChat(false)} className="text-neon-purple/50 hover:text-neon-purple"><X size={16}/></button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/40">
                         {blueprintMessages.length === 0 && (
                           <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-50">
                              <HelpCircle className="w-10 h-10 text-ghost-500" />
                              <p className="text-sm text-ghost-400 px-8">Ask about design patterns, data flow, or specific module responsibilities.</p>
                           </div>
                         )}
                         {blueprintMessages.map((m, i) => (
                           <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                             <div className={`max-w-[85%] rounded-xl p-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-neon-purple text-white' : 'bg-white/10 text-ghost-200'}`}>
                               {m.text}
                             </div>
                           </div>
                         ))}
                         {isBlueprintThinking && (
                           <div className="flex justify-start">
                             <div className="bg-white/5 rounded-xl p-3 flex gap-1">
                               <span className="w-1.5 h-1.5 bg-ghost-500 rounded-full animate-bounce"></span>
                               <span className="w-1.5 h-1.5 bg-ghost-500 rounded-full animate-bounce delay-100"></span>
                               <span className="w-1.5 h-1.5 bg-ghost-500 rounded-full animate-bounce delay-200"></span>
                             </div>
                           </div>
                         )}
                      </div>
                      
                      <form onSubmit={handleBlueprintAsk} className="p-4 bg-black/20 border-t border-white/5 flex gap-2">
                         <input 
                           className="flex-1 bg-black/50 text-sm text-white p-3 rounded-lg border border-white/10 focus:border-neon-purple outline-none transition-colors"
                           placeholder="Query the blueprint..."
                           value={blueprintInput}
                           onChange={e => setBlueprintInput(e.target.value)}
                         />
                         <button type="submit" className="p-3 bg-neon-purple text-white rounded-lg hover:bg-neon-purple/80 transition-colors shadow-lg shadow-neon-purple/20">
                            <ArrowRight size={16}/>
                         </button>
                      </form>
                   </div>
                </div>
             )}
          </div>
        )}

        {/* --- GLOBAL OVERLAYS --- */}
        
        {/* Error Toast */}
        {error && (
           <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 animate-[fadeIn_0.3s]">
             <div className="glass-panel border-red-500/30 bg-red-950/20 px-6 py-4 rounded-xl flex items-center gap-4 shadow-[0_0_30px_-10px_rgba(239,68,68,0.3)]">
                <AlertCircle className="text-red-500" size={24} />
                <div className="text-sm text-red-100">
                  <p className="font-bold">{isQuotaError ? "API Quota Limit" : "Error Occurred"}</p>
                  <p className="opacity-80">{error}</p>
                </div>
                {isQuotaError && (
                  <button onClick={handleChangeApiKey} className="ml-4 px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-200 text-xs rounded border border-red-500/30 transition">
                    Update Key
                  </button>
                )}
                <button onClick={() => setError(null)} className="text-red-400 hover:text-white"><X size={16}/></button>
             </div>
           </div>
        )}

        {/* MVP Progress Modal */}
        {mvpProgress && (
           <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center">
              <div className="w-[450px] glass-panel-dark p-10 rounded-3xl border border-neon-purple/30 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-blue to-neon-purple animate-[shimmer_2s_infinite]"></div>
                 
                 <div className="flex items-center gap-5 mb-8">
                    <div className="w-12 h-12 rounded-full bg-neon-purple/10 flex items-center justify-center">
                       <Zap className="text-neon-purple animate-pulse" size={24} />
                    </div>
                    <div>
                       <h3 className="text-xl font-bold text-white">Forging Codebase</h3>
                       <p className="text-sm text-ghost-400 font-mono mt-1">AI Agent Active</p>
                    </div>
                 </div>
                 
                 <div className="space-y-2 mb-8">
                    <div className="flex justify-between text-xs text-ghost-400 uppercase tracking-wider font-bold">
                       <span>Progress</span>
                       <span>{Math.round((mvpProgress.current / mvpProgress.total) * 100)}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-neon-purple transition-all duration-300"
                         style={{ width: `${(mvpProgress.current / mvpProgress.total) * 100}%` }}
                       ></div>
                    </div>
                 </div>

                 <div className="bg-black/50 p-4 rounded-xl border border-white/5 font-mono text-xs text-ghost-300 truncate">
                    &gt; Writing: <span className="text-neon-blue">{mvpProgress.file}</span>
                 </div>
              </div>
           </div>
        )}

        {/* MVP Confirmation Modal */}
        {showMVPModal && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="max-w-md w-full glass-panel-dark rounded-2xl p-8 border border-white/10 shadow-2xl animate-[scaleIn_0.2s]">
                <h3 className="text-2xl font-bold text-white mb-2">Initialize Construction?</h3>
                <p className="text-base text-ghost-400 mb-8 leading-relaxed">
                  GhostGraph will systematically implement {graphData?.nodes.filter(n => n.type === FileType.FILE).length} files based on the defined spec. 
                  This process consumes significant token resources.
                </p>
                
                <div className="flex gap-4 justify-end">
                   <button 
                     onClick={() => setShowMVPModal(false)}
                     className="px-5 py-3 rounded-xl text-sm font-medium text-ghost-400 hover:text-white hover:bg-white/5 transition"
                   >
                     Abort
                   </button>
                   <button 
                     onClick={handleGenerateMVP}
                     className="px-8 py-3 rounded-xl text-sm font-bold bg-white text-black hover:scale-105 transition-transform shadow-lg shadow-white/10"
                   >
                     Confirm Sequence
                   </button>
                </div>
             </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;