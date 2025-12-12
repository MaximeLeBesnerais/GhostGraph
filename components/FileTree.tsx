import React, { useState, useEffect } from 'react';
import { NodeData, FileType } from '../types';
import { Folder, FileCode, ChevronRight, ChevronDown, Package, Circle, Box } from 'lucide-react';

interface FileTreeProps {
  nodes: NodeData[];
  onSelect: (node: NodeData) => void;
  selectedId?: string;
}

const TreeNode: React.FC<{ 
  node: NodeData; 
  allNodes: NodeData[]; 
  depth: number;
  onSelect: (node: NodeData) => void;
  selectedId?: string;
}> = ({ node, allNodes, depth, onSelect, selectedId }) => {
  const children = allNodes.filter(n => n.parentId === node.id);
  const hasChildren = children.length > 0;
  // Auto-expand root level folders or if selected
  const [isOpen, setIsOpen] = useState(depth < 1 || children.some(c => c.id === selectedId));
  
  useEffect(() => {
    if (children.some(c => c.id === selectedId)) {
        setIsOpen(true);
    }
  }, [selectedId, children]);

  const Icon = node.type === FileType.SERVICE 
    ? Package 
    : node.type === FileType.FOLDER 
      ? Folder 
      : FileCode;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) setIsOpen(!isOpen);
    onSelect(node);
  };

  const isSelected = selectedId === node.id;

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-2 py-1.5 px-3 cursor-pointer transition-all duration-200 border-l-2 ${
          isSelected 
            ? 'bg-white/10 border-neon-blue text-white' 
            : 'border-transparent text-ghost-400 hover:text-ghost-200 hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={handleClick}
      >
        <span className="text-ghost-600 w-4 flex justify-center">
           {hasChildren && (
             isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />
           )}
        </span>
        
        <Icon 
          size={14} 
          className={
            node.type === FileType.SERVICE ? 'text-neon-purple' : 
            node.type === FileType.FOLDER ? 'text-neon-blue/80' : 
            isSelected ? 'text-white' : 'opacity-70'
          } 
        />
        
        <span className={`text-xs truncate font-mono ${isSelected ? 'font-bold' : ''}`}>{node.name}</span>
      </div>
      
      {isOpen && hasChildren && (
        <div className="relative">
          {/* Guide Line */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-px bg-white/5" 
            style={{ left: `${depth * 16 + 19}px` }}
          />
          {children.map(child => (
            <TreeNode 
              key={child.id} 
              node={child} 
              allNodes={allNodes} 
              depth={depth + 1} 
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree: React.FC<FileTreeProps> = ({ nodes, onSelect, selectedId }) => {
  // Logic to handle "Double Source" / "Dot Root":
  // If we have a root node named "." or "root", we usually want to show its children as the top level
  // to avoid one useless folder at the top.
  let rootNodes = nodes.filter(n => !n.parentId || !nodes.find(p => p.id === n.parentId));

  // If there is exactly one root and it's named "." or "root", unwrap it.
  if (rootNodes.length === 1 && (rootNodes[0].name === '.' || rootNodes[0].name === 'root')) {
      const dotRoot = rootNodes[0];
      const children = nodes.filter(n => n.parentId === dotRoot.id);
      if (children.length > 0) {
          rootNodes = children;
      }
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin py-2">
      {rootNodes.map(node => (
        <TreeNode 
          key={node.id} 
          node={node} 
          allNodes={nodes} 
          depth={0} 
          onSelect={onSelect}
          selectedId={selectedId}
        />
      ))}
    </div>
  );
};

export default FileTree;