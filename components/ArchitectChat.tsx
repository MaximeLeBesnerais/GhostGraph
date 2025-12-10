import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage } from '../types';
import { Cpu, User, ArrowRight, CheckCircle2, FileText } from 'lucide-react';

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
  
  // State for the *active* form
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [finalComment, setFinalComment] = useState("");

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset answers when a new model message arrives
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'model') {
      setAnswers({});
    }
  }, [messages.length]);

  const handleSubmit = (questions: string[]) => {
    if (Object.keys(answers).length === 0 && !isLoading) return;
    
    // Format answers for the chat history/context
    const formattedResponse = questions.map((q, i) => {
        const ans = answers[i] || "Skipped";
        return `Q: ${q}\nA: ${ans}`;
    }).join('\n\n');

    onSendMessage(formattedResponse);
  };

  const parseMessage = (text: string): QuestionGroup | null => {
    try {
      // Clean up potentially markdown wrapped JSON
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-ghost-900 border-r border-ghost-800">
      {/* Header */}
      <div className="p-4 border-b border-ghost-800 flex justify-between items-center bg-ghost-950 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <Cpu size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Spec Builder</h2>
            <p className="text-xs text-ghost-400">Iterative Refinement</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-ghost-900">
        
        {messages.map((msg, idx) => {
          const isModel = msg.role === 'model';
          const isLastMessage = idx === messages.length - 1;
          const questionsData = isModel ? parseMessage(msg.text) : null;

          if (!isModel) {
            // RENDER USER MESSAGE (Historical Answer Block)
            return (
              <div key={idx} className="ml-8 relative animate-[fadeIn_0.3s]">
                 <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-ghost-800 -ml-4"></div>
                 <div className="bg-ghost-800/30 border border-ghost-700/50 rounded-lg p-4 text-sm text-ghost-300 italic">
                   <div className="flex items-center gap-2 mb-2 not-italic text-xs font-bold text-neon-blue">
                      <User size={12} /> YOUR ANSWERS
                   </div>
                   <div className="whitespace-pre-wrap">{msg.text}</div>
                 </div>
              </div>
            );
          }

          // RENDER MODEL MESSAGE
          if (questionsData) {
            // Structured JSON Question
            const isComplete = questionsData.isComplete;
            
            return (
              <div key={idx} className="w-full animate-[fadeIn_0.3s_ease-out]">
                <div className="bg-ghost-950 border border-ghost-800 rounded-xl p-1 shadow-lg relative ml-2 overflow-hidden">
                  
                  {/* Title Bar */}
                  <div className="bg-ghost-900/50 border-b border-ghost-800 p-4 flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-neon-purple shadow-[0_0_8px_rgba(168,85,247,0.6)]"></div>
                     <span className="text-xs font-bold text-neon-purple tracking-widest uppercase">
                       {questionsData.sectionTitle || 'Refinement Step'}
                     </span>
                     {isComplete && (
                        <span className="ml-auto text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded border border-green-800 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Complete
                        </span>
                     )}
                  </div>

                  {/* Questions Content */}
                  <div className="p-5 space-y-6">
                    {questionsData.questions.map((q, qIdx) => (
                      <div key={qIdx} className="space-y-3">
                        {/* Question Text */}
                        <div className="text-sm font-medium text-ghost-100 leading-relaxed">
                          {q}
                        </div>

                        {/* Input Area (Only if this is the active turn and NOT complete) */}
                        {isLastMessage && !isComplete && (
                           <div className="relative group">
                              <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-blue to-neon-purple rounded-lg opacity-0 group-focus-within:opacity-30 transition duration-500 blur"></div>
                              <textarea
                                value={answers[qIdx] || ''}
                                onChange={(e) => setAnswers(prev => ({...prev, [qIdx]: e.target.value}))}
                                placeholder="Type your answer..."
                                className="relative w-full bg-ghost-900 text-ghost-200 placeholder-ghost-600 px-4 py-3 rounded-lg border border-ghost-700 focus:outline-none focus:border-neon-blue min-h-[80px] text-sm resize-y"
                                disabled={isLoading}
                              />
                           </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Footer Actions (Only active turn) */}
                  {isLastMessage && !isComplete && (
                    <div className="bg-ghost-900/50 border-t border-ghost-800 p-4 flex justify-end">
                       <button 
                         onClick={() => handleSubmit(questionsData.questions)}
                         disabled={isLoading || Object.keys(answers).length === 0}
                         className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-neon-blue hover:bg-blue-600 rounded-lg transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-blue-900/20"
                       >
                         {isLoading ? 'Sending...' : 'Send Answers'} <ArrowRight size={16} />
                       </button>
                    </div>
                  )}
                  
                  {isComplete && isLastMessage && (
                     <div className="p-5 border-t border-ghost-800 bg-ghost-900/30">
                        <div className="mb-4 space-y-2">
                           <h4 className="text-xs font-bold text-ghost-400 uppercase flex items-center gap-2">
                              <FileText size={14}/> Final Comments (Optional)
                           </h4>
                           <p className="text-xs text-ghost-500">
                             Add any specific overrides, file naming conventions, or additional requirements for the blueprint generator.
                           </p>
                           <textarea
                              value={finalComment}
                              onChange={(e) => setFinalComment(e.target.value)}
                              placeholder="e.g. Use Clean Architecture, prefer Interface naming with 'I' prefix..."
                              className="w-full bg-ghost-950 text-ghost-300 p-3 rounded border border-ghost-700 focus:border-green-600 focus:outline-none text-sm min-h-[80px]"
                           />
                        </div>
                        <button 
                          onClick={() => onGenerate(finalComment)}
                          className="w-full py-3 bg-gradient-to-r from-green-700 to-emerald-600 hover:from-green-600 hover:to-emerald-500 text-white font-bold rounded shadow-lg transition-all flex justify-center items-center gap-2"
                        >
                          <Cpu size={18} /> Generate Final Blueprint
                        </button>
                     </div>
                  )}

                </div>
              </div>
            );
          } 
          
          // Fallback for unstructured text (e.g. error messages or intro text if not JSON)
          return (
             <div key={idx} className="bg-ghost-950 border border-ghost-800 rounded-xl p-5 shadow-lg relative ml-2 mb-4">
                <div className="text-sm leading-relaxed text-ghost-300 whitespace-pre-wrap">
                  {msg.text}
                </div>
             </div>
          );

        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="ml-2 mt-4 bg-ghost-950 border border-ghost-800 rounded-xl p-5 shadow-lg w-full max-w-[80%] animate-pulse">
            <div className="h-4 bg-ghost-800 rounded w-32 mb-4"></div>
            <div className="space-y-3">
              <div className="h-20 bg-ghost-800 rounded w-full"></div>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
};

export default ArchitectChat;