import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage } from '../types';
import { Cpu, User, ArrowRight, CheckCircle2, FileText, Send, Sparkles } from 'lucide-react';

interface ArchitectChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onGenerate: (finalComment?: string) => void;
  isLoading: boolean;
}

interface QuestionGroup {
  sectionTitle: string;
  questions: string[];
  isComplete?: boolean;
}

const ArchitectChat: React.FC<ArchitectChatProps> = ({ messages, onSendMessage, onGenerate, isLoading }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [finalComment, setFinalComment] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'model') {
      setAnswers({});
    }
  }, [messages.length]);

  const handleSubmit = (questions: string[]) => {
    if (Object.keys(answers).length === 0 && !isLoading) return;
    const formattedResponse = questions.map((q, i) => {
        const ans = answers[i] || "Skipped";
        return `Q: ${q}\nA: ${ans}`;
    }).join('\n\n');
    onSendMessage(formattedResponse);
  };

  const parseMessage = (text: string): QuestionGroup | null => {
    try {
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-ghost-950/40">
      {/* Header */}
      <div className="p-6 md:p-8 border-b border-white/5 bg-black/20 shrink-0 flex items-center justify-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.1)]">
            <Cpu size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Architect Session</h2>
            <div className="flex items-center gap-2 mt-0.5">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               <span className="text-sm text-ghost-400 font-mono">System Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Stream */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 scrollbar-thin">
        <div className="max-w-3xl mx-auto space-y-16">
          
          {messages.map((msg, idx) => {
            const isModel = msg.role === 'model';
            const isLastMessage = idx === messages.length - 1;
            const questionsData = isModel ? parseMessage(msg.text) : null;

            // USER MESSAGE
            if (!isModel) {
              return (
                <div key={idx} className="flex justify-end animate-[fadeIn_0.3s]">
                  <div className="max-w-2xl w-full bg-white/5 border border-white/5 rounded-2xl p-8 relative shadow-xl">
                    <div className="absolute -right-3 top-8 w-3 h-3 bg-white/5 rotate-45 border-t border-r border-white/5"></div>
                    <div className="flex items-center gap-2 mb-4 text-sm font-bold text-ghost-400 uppercase tracking-wider">
                        <User size={14} /> You
                    </div>
                    <div className="text-ghost-100 whitespace-pre-wrap leading-relaxed text-lg font-light">
                        {msg.text}
                    </div>
                  </div>
                </div>
              );
            }

            // MODEL MESSAGE (Structured)
            if (questionsData) {
              const isComplete = questionsData.isComplete;
              return (
                <div key={idx} className="flex justify-start animate-[slideUp_0.4s_ease-out]">
                  <div className="w-full">
                      
                      {/* Agent Avatar Area */}
                      <div className="flex items-center gap-3 mb-6">
                        <Sparkles size={20} className="text-neon-purple"/>
                        <span className="text-sm font-bold text-neon-purple tracking-widest uppercase">
                            {questionsData.sectionTitle || 'Analysis'}
                        </span>
                      </div>

                      <div className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-3xl p-1 overflow-hidden shadow-2xl">
                        <div className="bg-black/40 backdrop-blur-md rounded-[20px] p-8 md:p-10 space-y-10">
                            
                            {questionsData.questions.map((q, qIdx) => (
                              <div key={qIdx} className="space-y-6">
                                <p className="text-xl md:text-2xl font-medium text-white leading-relaxed">
                                  {q}
                                </p>
                                {isLastMessage && !isComplete && (
                                    <div className="relative group">
                                      <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-blue to-neon-purple rounded-xl opacity-0 group-focus-within:opacity-50 transition duration-500 blur"></div>
                                      <textarea
                                        value={answers[qIdx] || ''}
                                        onChange={(e) => setAnswers(prev => ({...prev, [qIdx]: e.target.value}))}
                                        placeholder="Enter your specification..."
                                        className="relative w-full bg-black text-white placeholder-ghost-600 px-6 py-5 rounded-xl border border-white/10 focus:outline-none focus:border-transparent min-h-[80px] text-base resize-none transition-all"
                                        disabled={isLoading}
                                      />
                                    </div>
                                )}
                              </div>
                            ))}

                            {isLastMessage && !isComplete && (
                              <div className="flex justify-end pt-6 border-t border-white/5">
                                  <button 
                                    onClick={() => handleSubmit(questionsData.questions)}
                                    disabled={isLoading || Object.keys(answers).length === 0}
                                    className="flex items-center gap-3 px-8 py-4 bg-white text-black font-bold text-lg rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                                  >
                                    {isLoading ? 'Processing...' : 'Submit Response'} <ArrowRight size={20} />
                                  </button>
                              </div>
                            )}

                            {isComplete && isLastMessage && (
                              <div className="pt-8 border-t border-white/10">
                                  <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6 mb-8 flex items-start gap-4">
                                    <CheckCircle2 className="text-green-500 mt-1" size={24} />
                                    <div>
                                        <h4 className="font-bold text-green-100 text-lg">Context Sufficient</h4>
                                        <p className="text-sm text-green-200/70 mt-2">Ready to generate architectural blueprint.</p>
                                    </div>
                                  </div>

                                  <div className="space-y-4 mb-8">
                                    <label className="text-sm font-bold text-ghost-500 uppercase tracking-wide">Final Directives (Optional)</label>
                                    <textarea
                                        value={finalComment}
                                        onChange={(e) => setFinalComment(e.target.value)}
                                        placeholder="e.g. Enforce strict Clean Architecture, Use feature-sliced design..."
                                        className="w-full bg-black/50 text-ghost-200 p-6 rounded-xl border border-white/10 focus:border-green-500/50 focus:outline-none text-base min-h-[120px]"
                                    />
                                  </div>
                                  <button 
                                    onClick={() => onGenerate(finalComment)}
                                    className="w-full py-5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-green-900/20 hover:shadow-green-900/40 hover:scale-[1.01] transition-all flex justify-center items-center gap-3"
                                  >
                                    <Cpu size={24} /> INITIALIZE GENERATION SEQUENCE
                                  </button>
                              </div>
                            )}
                        </div>
                      </div>
                  </div>
                </div>
              );
            }

            // FALLBACK TEXT MESSAGE
            return (
              <div key={idx} className="flex justify-start mb-8">
                  <div className="max-w-2xl text-ghost-200 text-base leading-relaxed bg-white/5 p-6 rounded-2xl border border-white/5">
                    {msg.text}
                  </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-center py-10">
                <div className="flex items-center gap-3 text-ghost-500 text-sm font-mono uppercase tracking-widest animate-pulse">
                  <span className="w-2 h-2 bg-neon-blue rounded-full"></span>
                  Architect Thinking...
                </div>
            </div>
          )}
          
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>
    </div>
  );
};

export default ArchitectChat;