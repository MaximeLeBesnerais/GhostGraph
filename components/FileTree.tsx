import React, { useState } from 'react';
import { NodeData, FileType } from '../types';
import { Folder, FileCode, ChevronRight, ChevronDown, Package } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(true);
  
  // Find children
  const children = allNodes.filter(n => n.parentId === node.id);
  const hasChildren = children.length > 0;
  
  const Icon = node.type === FileType.SERVICE 
    ? Package 
    : node.type === FileType.FOLDER 
      ? Folder 
      : FileCode;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
    onSelect(node);
  };

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer hover:bg-ghost-800 transition-colors ${
          selectedId === node.id ? 'bg-ghost-800 text-neon-blue' : 'text-ghost-400'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        <span className="text-ghost-500">
           {hasChildren ? (
             isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />
           ) : <div className="w-3" />}
        </span>
        <Icon size={14} className={node.type === FileType.SERVICE ? 'text-neon-purple' : node.type === FileType.FOLDER ? 'text-neon-blue' : ''} />
        <span className="text-sm truncate font-mono">{node.name}</span>
      </div>
      
      {isOpen && hasChildren && (
        <div>
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
  // Get root nodes (those without parents or whose parents don't exist in the set)
  const rootNodes = nodes.filter(n => !n.parentId || !nodes.find(p => p.id === n.parentId));

  return (
    <div className="h-full overflow-y-auto bg-ghost-900 border-l border-ghost-800 py-2">
      <div className="px-4 py-2 text-xs font-semibold text-ghost-500 uppercase tracking-wider mb-2">
        Project Explorer
      </div>
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