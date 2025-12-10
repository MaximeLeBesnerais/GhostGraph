export enum AppPhase {
  INPUT = 'INPUT',
  REFINEMENT = 'REFINEMENT', // Chatting with the architect
  GENERATING = 'GENERATING', // AI creating the JSON
  VISUALIZATION = 'VISUALIZATION', // Viewing the graph
}

export enum FileType {
  FILE = 'FILE',
  FOLDER = 'FOLDER',
  SERVICE = 'SERVICE', // For microservices/containers
}

export interface NodeData {
  id: string;
  name: string;
  type: FileType;
  description?: string;
  techStack?: string[]; // e.g. ["React", "Tailwind"]
  parentId?: string | null;
  content?: string; // The actual code of the file
}

export interface LinkData {
  source: string;
  target: string;
  type: 'IMPORT' | 'DEPENDENCY' | 'DATA_FLOW';
}

export interface GraphData {
  nodes: NodeData[];
  links: LinkData[];
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}

export interface ProjectContext {
  originalIdea: string;
  language: string;
  refinedSpecs: string;
}