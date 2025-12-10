import React, { useState, useRef, useEffect } from 'react';
import { AppPhase, ChatMessage, GraphData, NodeData, FileType } from './types';
import { 
  initArchitectChat, 
  sendMessageToArchitect, 
  generateProjectBlueprint, 
  initBlueprintChat, 
  askBlueprintQuestion,
  generateFileCode 
} from './services/geminiService';
import ArchitectChat from './components/ArchitectChat';
import GraphVisualizer from './components/GraphVisualizer';
import FileTree from './components/FileTree';
import { Sparkles, ArrowRight, LayoutGrid, AlertCircle, Download, MessageSquare, Send, X, HelpCircle, Crosshair, Code2, AlertTriangle, Key } from 'lucide-react';
import JSZip from 'jszip';

function App() {
  const [phase, setPhase] = useState<AppPhase>(AppPhase.INPUT);
  const [initialIdea, setInitialIdea] = useState("");
  const [language, setLanguage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [focusTrigger, setFocusTrigger] = useState(0);
  
  // Blueprint Chat State
  const [showBlueprintChat, setShowBlueprintChat] = useState(false);
  const [blueprintMessages, setBlueprintMessages] = useState<ChatMessage[]>([]);
  const [blueprintInput, setBlueprintInput] = useState("");
  const [isBlueprintThinking, setIsBlueprintThinking] = useState(false);

  // MVP Generation State
  const [showMVPModal, setShowMVPModal] = useState(false);
  const [mvpProgress, setMvpProgress] = useState<{current: number, total: number, file: string} | null>(null);

  const handleApiError = (e: any) => {
    console.error(e);
    const msg = e.message || e.toString();
    if (msg.includes('429') || msg.includes('Quota') || msg.includes('403') || msg.includes('key')) {
      setIsQuotaError(true);
      setError("API Quota Exceeded or Invalid Key. Please update your API key to continue.");
    } else {
      setError("An unexpected error occurred. Please try again.");
    }
  };

  const handleChangeApiKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
       try {
         await window.aistudio.openSelectKey();
         setError(null);
         setIsQuotaError(false);
         // Optionally reset chat or allow retry
       } catch (e) {
         console.error("Failed to open key selector", e);
       }
    } else {
      alert("API Key selection is not available in this environment.");
    }
  };

  // Phase 1: Start Conversation
  const handleStartRefinement = async () => {
    if (!initialIdea.trim() || !language.trim()) {
      setError("Please provide both an idea and a preferred language.");
      return;
    }
    
    setPhase(AppPhase.REFINEMENT);
    setIsLoading(true);
    setError(null);
    setIsQuotaError(false);
    
    try {
      // Init Chat
      initArchitectChat();
      
      // User message
      const userMsg: ChatMessage = { role: 'user', text: `${initialIdea} (Stack: ${language})` };
      setMessages([userMsg]);
      
      // Get First Response
      const response = await sendMessageToArchitect(initialIdea);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) {
      handleApiError(e);
      setPhase(AppPhase.INPUT);
    } finally {
      setIsLoading(false);
    }
  };

  // Phase 2: Chat Loop
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

  // Phase 3: Generate
  const handleGenerateBlueprint = async (finalComment?: string) => {
    setPhase(AppPhase.GENERATING);
    try {
      // Summarize context for generation
      const context = messages.map(m => `${m.role}: ${m.text}`).join('\n');
      const data = await generateProjectBlueprint(context, language, finalComment);
      setGraphData(data);
      initBlueprintChat(data);
      setPhase(AppPhase.VISUALIZATION);
    } catch (e) {
      handleApiError(e);
      setPhase(AppPhase.REFINEMENT);
    }
  };

  // MVP Generation Logic
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
        
        // Find dependencies to give context
        const dependencies = graphData.links
          .filter(l => l.source === node.id || l.target === node.id)
          .map(l => {
             const otherId = l.source === node.id ? l.target : l.source;
             const otherNode = graphData.nodes.find(n => n.id === otherId);
             return otherNode ? `${otherNode.name} (${otherNode.description})` : "";
          })
          .filter(Boolean);

        const code = await generateFileCode(
          node, 
          initialIdea, 
          dependencies
        );
        
        // Update local state
        const nodeIndex = updatedNodes.findIndex(n => n.id === node.id);
        if (nodeIndex !== -1) {
          updatedNodes[nodeIndex] = { ...updatedNodes[nodeIndex], content: code };
        }
      }
      
      setGraphData({ ...graphData, nodes: updatedNodes });
    } catch (e) {
      handleApiError(e);
    } finally {
      setMvpProgress(null);
    }
  };

  // Visualization: Export Zip
  const handleExportZip = async () => {
    if (!graphData) return;
    
    const zip = new JSZip();
    
    // Create a map for quick parent lookup
    const nodeMap = new Map<string, NodeData>(graphData.nodes.map(n => [n.id, n]));
    
    // Helper to build path
    const getPath = (nodeId: string): string => {
      const node = nodeMap.get(nodeId);
      if (!node) return "";
      const parentPath = node.parentId ? getPath(node.parentId) : "";
      return parentPath ? `${parentPath}/${node.name}` : node.name;
    };

    // Construct Tree for README
    let treeString = "";
    const buildTreeString = (parentId: string | null | undefined, depth: number) => {
       const children = graphData.nodes.filter(n => n.parentId == parentId); // exact match (null vs undefined)
       children.forEach((node, index) => {
          const isLast = index === children.length - 1;
          const prefix = "  ".repeat(depth) + (isLast ? "└── " : "├── ");
          treeString += `${prefix}${node.name}\n`;
          buildTreeString(node.id, depth + 1);
       });
    };
    buildTreeString(null, 0);

    // Enhanced README
    const readmeContent = `# ${initialIdea}

Generated by **GhostGraph** 
Language/Stack: **${language}**

## Project Overview
${messages[0]?.text || "No description provided."}

## Architecture
This project is structured as follows:

\`\`\`text
${treeString || "(Flat structure)"}
\`\`\`

## Getting Started

### Prerequisites
- Ensure you have the runtime for **${language}** installed.
- Install dependencies (check package configuration files).

### Installation
1. Unzip this project.
2. Run dependency installation commands (e.g., \`npm install\`, \`pip install -r requirements.txt\`, etc., depending on the stack).

## Component Guide
${graphData.nodes.map(n => n.type !== FileType.FOLDER ? `- **${n.name}**: ${n.description || 'No description'}` : '').filter(Boolean).join('\n')}

---
*Generated by GhostGraph AI*
`;

    zip.file("README.md", readmeContent);

    // Add LLM Instruction File
    let instructions = `# Implementation Instructions\n\nUse this guide to implement the project "${initialIdea}" using ${language}.\n\n## File Manifest\n`;

    graphData.nodes.forEach(node => {
      const path = getPath(node.id);
      
      if (node.type === FileType.FOLDER || node.type === FileType.SERVICE) {
        zip.folder(path);
      } else {
        // Use generated content if available, otherwise template
        const content = node.content || `/*\n * File: ${node.name}\n * Description: ${node.description}\n * Tech Stack: ${node.techStack?.join(', ')}\n * \n * TODO: Implement functionality.\n */`;
        zip.file(path, content);
        
        // Add to instructions
        instructions += `\n### ${path}\n- **Type**: ${node.type}\n- **Purpose**: ${node.description || 'N/A'}\n- **Tech Stack**: ${node.techStack?.join(', ') || 'Standard'}\n`;
        
        // Find imports (links targeting this node)
        const incoming = graphData.links.filter(l => l.target === node.id).map(l => {
             const src = nodeMap.get(l.source);
             return src ? src.name : l.source;
        });
        if(incoming.length > 0) {
            instructions += `- **Imported By**: ${incoming.join(', ')}\n`;
        }
      }
    });
    
    zip.file("INSTRUCTIONS.md", instructions);

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ghostgraph-project.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Visualization: Blueprint Chat
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
      setBlueprintMessages(prev => [...prev, { role: 'model', text: "I encountered an error answering that." }]);
    } finally {
      setIsBlueprintThinking(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-black text-ghost-100 font-sans selection:bg-neon-purple selection:text-white">
      
      {/* Header */}
      <header className="h-14 border-b border-ghost-800 flex items-center px-6 bg-ghost-950 shrink-0 z-10 justify-between">
        <div className="flex items-center gap-2 text-ghost-100 font-bold tracking-tight">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
          </div>
          GhostGraph
        </div>
        
        {phase === AppPhase.VISUALIZATION && (
          <div className="flex items-center gap-2">
            {!mvpProgress && (
              <button 
                onClick={() => setShowMVPModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-neon-purple/20 to-neon-blue/20 hover:from-neon-purple/40 hover:to-neon-blue/40 border border-neon-purple/50 text-white rounded transition-all"
              >
                <Code2 size={14} /> Generate MVP
              </button>
            )}
            <button 
              onClick={handleExportZip}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-ghost-800 hover:bg-neon-blue/20 hover:text-neon-blue border border-ghost-700 hover:border-neon-blue rounded transition-all"
            >
              <Download size={14} /> Export Zip
            </button>
            <button 
              onClick={() => setShowBlueprintChat(!showBlueprintChat)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded transition-all ${showBlueprintChat ? 'bg-neon-purple text-white border-neon-purple' : 'bg-ghost-800 border-ghost-700 text-ghost-300 hover:text-white'}`}
            >
              <HelpCircle size={14} /> Ask Architect
            </button>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-ghost-500 font-mono hidden md:flex">
           <span className={`flex items-center gap-1 ${phase === AppPhase.INPUT ? 'text-neon-blue' : ''}`}>
             <span className="w-1.5 h-1.5 rounded-full bg-current"></span> Input
           </span>
           <span className="w-4 h-px bg-ghost-800"></span>
           <span className={`flex items-center gap-1 ${phase === AppPhase.REFINEMENT ? 'text-neon-blue' : ''}`}>
             <span className="w-1.5 h-1.5 rounded-full bg-current"></span> Refine
           </span>
           <span className="w-4 h-px bg-ghost-800"></span>
           <span className={`flex items-center gap-1 ${phase === AppPhase.VISUALIZATION ? 'text-neon-blue' : ''}`}>
             <span className="w-1.5 h-1.5 rounded-full bg-current"></span> Blueprint
           </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex">
        
        {/* Error Overlay / Toast */}
        {error && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 text-red-100 border border-red-700 px-6 py-4 rounded-xl shadow-2xl animate-[fadeIn_0.3s] max-w-md w-full flex flex-col items-center gap-3 backdrop-blur-md`}>
            <div className="flex items-center gap-2 w-full justify-center text-lg font-bold">
              <AlertCircle size={24} />
              <span>{isQuotaError ? "API Quota Limit Reached" : "Error Occurred"}</span>
            </div>
            <p className="text-sm text-red-200 text-center">{error}</p>
            
            {isQuotaError && (
              <button 
                onClick={handleChangeApiKey}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg font-bold transition-colors shadow-lg"
              >
                <Key size={16} /> Update API Key
              </button>
            )}
            
            <button onClick={() => { setError(null); setIsQuotaError(false); }} className="absolute top-2 right-2 text-red-400 hover:text-white"><X size={16}/></button>
          </div>
        )}

        {/* MVP Progress Overlay */}
        {mvpProgress && (
           <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center flex-col">
              <div className="w-96 bg-ghost-900 border border-ghost-700 p-6 rounded-xl shadow-2xl">
                 <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                   <Code2 className="text-neon-purple animate-pulse" /> Generating MVP...
                 </h3>
                 <p className="text-xs text-ghost-400 mb-4">Writing code for: <span className="text-neon-blue font-mono">{mvpProgress.file}</span></p>
                 
                 <div className="w-full bg-ghost-800 h-2 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-gradient-to-r from-neon-blue to-neon-purple transition-all duration-300"
                      style={{ width: `${(mvpProgress.current / mvpProgress.total) * 100}%` }}
                    ></div>
                 </div>
                 <div className="flex justify-between text-xs text-ghost-500">
                    <span>{mvpProgress.current} / {mvpProgress.total} Files</span>
                    <span>{Math.round((mvpProgress.current / mvpProgress.total) * 100)}%</span>
                 </div>
              </div>
           </div>
        )}

        {/* MVP Confirmation Modal */}
        {showMVPModal && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-ghost-900 border border-ghost-700 rounded-xl p-6 shadow-2xl animate-[fadeIn_0.2s]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-neon-purple/20 rounded-full">
                  <Sparkles size={24} className="text-neon-purple" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Generate Code MVP?</h3>
                  <p className="text-xs text-ghost-400">Experimental Feature</p>
                </div>
              </div>
              
              <div className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded-lg flex gap-3 mb-6">
                <AlertTriangle className="text-yellow-500 shrink-0" size={20} />
                <p className="text-xs text-yellow-200 leading-relaxed">
                  This process will generate actual code for <strong>{graphData?.nodes.filter(n => n.type === FileType.FILE).length} files</strong> individually. 
                  <br/><br/>
                  This consumes a significant amount of API tokens and may take a few minutes. If you run out of credits, you will be prompted to change your key.
                </p>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setShowMVPModal(false)}
                  className="px-4 py-2 rounded text-sm font-medium text-ghost-300 hover:text-white hover:bg-ghost-800 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleGenerateMVP}
                  className="px-4 py-2 rounded text-sm font-bold bg-neon-purple hover:bg-neon-purple/80 text-white shadow-lg shadow-purple-900/20 transition"
                >
                  Start Generation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 1: INPUT */}
        {phase === AppPhase.INPUT && (
          <div className="w-full h-full flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_#18181b_0%,_#09090b_100%)]">
            <div className="max-w-2xl w-full space-y-8 animate-[fadeIn_0.5s_ease-out]">
              <div className="space-y-2 text-center">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-ghost-500">
                  Blueprint First.<br/>Code Second.
                </h1>
                <p className="text-ghost-400 text-lg">
                  Transform your raw idea into a rigorous architectural map.
                </p>
              </div>
              
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-blue to-neon-purple rounded-xl opacity-30 group-hover:opacity-60 blur transition duration-500"></div>
                <div className="relative bg-ghost-900 rounded-xl p-6 border border-ghost-800 shadow-2xl space-y-4">
                  
                  {/* Idea Input */}
                  <div>
                    <label className="text-xs font-semibold text-ghost-500 uppercase tracking-wider mb-2 block">Project Concept</label>
                    <textarea 
                      value={initialIdea} 
                      onChange={(e) => setInitialIdea(e.target.value)}
                      placeholder="Describe your project... (e.g., 'A real-time collaborative code editor with video chat')"
                      className="w-full h-32 bg-ghost-950/50 text-ghost-100 placeholder-ghost-600 focus:outline-none resize-none text-lg p-3 rounded-lg border border-ghost-700 focus:border-neon-blue transition-colors"
                    />
                  </div>

                  {/* Language Input */}
                  <div>
                    <label className="text-xs font-semibold text-ghost-500 uppercase tracking-wider mb-2 block">Primary Stack / Language</label>
                    <input 
                      type="text"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      placeholder="e.g. TypeScript, Python, Go, Rust..."
                      className="w-full bg-ghost-950/50 text-ghost-100 placeholder-ghost-600 focus:outline-none p-3 rounded-lg border border-ghost-700 focus:border-neon-purple transition-colors"
                    />
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-ghost-800">
                    <span className="text-xs text-ghost-500 flex items-center gap-1">
                      <Sparkles size={12} className="text-neon-purple"/> AI-Powered Architect
                    </span>
                    <button 
                      onClick={handleStartRefinement}
                      disabled={!initialIdea.trim() || !language.trim() || isLoading}
                      className="flex items-center gap-2 bg-ghost-100 text-black px-6 py-2.5 rounded-lg font-bold hover:bg-white hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-white/10"
                    >
                      {isLoading ? 'Connecting...' : 'Start Planning'} <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: REFINEMENT (Chat) */}
        {phase === AppPhase.REFINEMENT && (
          <div className="w-full max-w-4xl mx-auto h-full shadow-2xl border-x border-ghost-800">
            <ArchitectChat 
              messages={messages} 
              onSendMessage={handleSendMessage}
              onGenerate={handleGenerateBlueprint}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* VIEW 3: LOADING GENERATION */}
        {phase === AppPhase.GENERATING && (
          <div className="w-full flex flex-col items-center justify-center space-y-6 bg-ghost-950">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-t-4 border-neon-blue rounded-full animate-spin"></div>
              <div className="absolute inset-2 border-r-4 border-neon-purple rounded-full animate-spin [animation-direction:reverse]"></div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-medium text-white">Constructing Logic Map</h3>
              <p className="text-ghost-400 text-sm">Defining dependencies and resolving modules...</p>
            </div>
          </div>
        )}

        {/* VIEW 4: VISUALIZATION */}
        {phase === AppPhase.VISUALIZATION && graphData && (
          <>
            {/* Sidebar File Tree */}
            <div className="w-72 shrink-0 h-full border-r border-ghost-800 flex flex-col z-20 shadow-xl bg-ghost-950">
               <div className="p-4 border-b border-ghost-800">
                  <h2 className="text-sm font-bold text-white mb-1">{initialIdea.substring(0, 30)}...</h2>
                  <div className="text-xs text-ghost-500">{language}</div>
               </div>
               
               <FileTree 
                 nodes={graphData.nodes} 
                 onSelect={(n) => setSelectedNode(n)}
                 selectedId={selectedNode?.id}
               />
               
               {/* Selected Details */}
               <div className="h-1/3 border-t border-ghost-800 bg-ghost-900 p-4 overflow-y-auto">
                 <h3 className="text-xs font-bold text-ghost-500 uppercase mb-2">Node Details</h3>
                 {selectedNode ? (
                   <div className="space-y-3">
                     <div>
                       <div className="text-lg font-mono text-white break-all">{selectedNode.name}</div>
                       <span className="text-[10px] px-1.5 py-0.5 rounded bg-ghost-800 text-ghost-400 border border-ghost-700 mt-1 inline-block">
                         {selectedNode.type}
                       </span>
                       {selectedNode.content && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-800 inline-block">
                            CODE GENERATED
                          </span>
                       )}
                     </div>
                     <p className="text-sm text-ghost-300 leading-relaxed">
                       {selectedNode.description || "No description provided."}
                     </p>
                     {selectedNode.techStack && (
                       <div className="flex flex-wrap gap-1">
                         {selectedNode.techStack.map(t => (
                           <span key={t} className="text-[10px] text-neon-cyan bg-neon-cyan/10 px-1 rounded">
                             {t}
                           </span>
                         ))}
                       </div>
                     )}
                     
                     <button 
                       onClick={() => setFocusTrigger(Date.now())}
                       className="w-full mt-2 flex items-center justify-center gap-2 py-1.5 border border-ghost-700 rounded text-xs text-ghost-400 hover:text-white hover:bg-ghost-800 transition"
                     >
                       <Crosshair size={12} /> Focus on Node
                     </button>
                   </div>
                 ) : (
                   <p className="text-sm text-ghost-600 italic">Select a node to view details.</p>
                 )}
               </div>
            </div>

            {/* Main Graph Area */}
            <div className="flex-1 relative h-full bg-ghost-900 overflow-hidden">
              <GraphVisualizer 
                data={graphData} 
                onNodeSelect={(n) => setSelectedNode(n)} 
                selectedNodeId={selectedNode?.id}
                focusTrigger={focusTrigger}
              />
              
              {/* Reset Button */}
              <button 
                onClick={() => setPhase(AppPhase.REFINEMENT)}
                className="absolute top-4 right-4 z-30 bg-ghost-800 hover:bg-ghost-700 text-ghost-200 p-2 rounded-lg border border-ghost-700 shadow-lg flex items-center gap-2 text-sm transition"
              >
                <LayoutGrid size={16} /> Back to Spec
              </button>

              {/* Blueprint Chat Overlay */}
              {showBlueprintChat && (
                <div className="absolute bottom-4 right-4 w-96 h-[500px] bg-ghost-950 border border-ghost-700 rounded-xl shadow-2xl flex flex-col overflow-hidden z-40 animate-[slideUp_0.3s_ease-out]">
                   <div className="p-3 border-b border-ghost-800 bg-ghost-900 flex justify-between items-center">
                     <span className="text-sm font-semibold flex items-center gap-2">
                       <Sparkles size={14} className="text-neon-purple"/> Blueprint Architect
                     </span>
                     <button onClick={() => setShowBlueprintChat(false)} className="text-ghost-500 hover:text-white"><X size={14}/></button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20">
                      {blueprintMessages.length === 0 && (
                        <div className="text-center mt-10 space-y-2">
                           <HelpCircle className="w-8 h-8 text-ghost-600 mx-auto" />
                           <p className="text-xs text-ghost-400">Ask questions about the organization,<br/>design patterns, or specific files.</p>
                        </div>
                      )}
                      {blueprintMessages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${m.role === 'user' ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30' : 'bg-ghost-800 text-ghost-200 border border-ghost-700'}`}>
                            {m.text}
                          </div>
                        </div>
                      ))}
                      {isBlueprintThinking && (
                        <div className="flex justify-start">
                           <div className="bg-ghost-800 rounded-lg p-3 text-xs text-ghost-400 border border-ghost-700 flex gap-1">
                             <span className="animate-bounce">●</span>
                             <span className="animate-bounce delay-100">●</span>
                             <span className="animate-bounce delay-200">●</span>
                           </div>
                        </div>
                      )}
                   </div>
                   
                   <form onSubmit={handleBlueprintAsk} className="p-3 border-t border-ghost-800 bg-ghost-900 flex gap-2">
                     <input 
                      className="flex-1 bg-ghost-950 text-xs text-white p-2.5 rounded border border-ghost-700 focus:border-neon-purple outline-none focus:bg-ghost-900 transition-colors" 
                      placeholder="Ask about the architecture..."
                      value={blueprintInput}
                      onChange={e => setBlueprintInput(e.target.value)}
                     />
                     <button type="submit" className="p-2.5 bg-neon-purple hover:bg-neon-purple/80 text-white rounded transition shadow-[0_0_10px_rgba(139,92,246,0.2)]"><Send size={14}/></button>
                   </form>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;