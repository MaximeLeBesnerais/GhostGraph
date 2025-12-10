import { GoogleGenAI, Type, Chat } from "@google/genai";
import { GraphData, FileType, NodeData } from "../types";

// Initialize the client
// NOTE: Process.env.API_KEY is injected by the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ARCHITECT_SYSTEM_INSTRUCTION = `
You are GhostGraph, an expert Senior Software Architect. 
Your goal is to help a developer refine a rough project idea into a concrete architectural plan.

PHASE 1: REFINEMENT
You must output your responses in strictly valid JSON format.
Do not output markdown code blocks. Just the raw JSON object.

Structure:
{
  "sectionTitle": "string (The topic of these questions, e.g. 'Data Strategy')",
  "questions": [
    "string (Question 1)",
    "string (Question 2)"
  ],
  "isComplete": boolean (true only if you have gathered enough info to build the full file map. Usually after 3-4 turns.)
}

Guidelines:
- Ask 1-3 specific, high-value questions at a time.
- Group questions by topic (e.g., "Data Strategy", "Frontend Architecture").
- Keep questions concise.
- If the user's initial idea is vague, ask about the Core Functionality first.
- Once you have clarity on: 1. Deployment 2. Data 3. Tech Stack 4. Key Modules -> set "isComplete": true.
`;

const BLUEPRINT_SYSTEM_INSTRUCTION = `
You are a system generator. Your job is to output a JSON structure representing the file system and dependency graph of a software project based on the user's description.
- Create a realistic folder structure.
- Define key files (entry points, services, components, utils).
- Define dependencies (imports) between these files.
- Be specific with naming conventions based on the specified language/framework.
- Ensure the 'parentId' field correctly reflects the folder hierarchy.
`;

const BLUEPRINT_CHAT_INSTRUCTION = `
You are an intelligent assistant explaining a software architecture blueprint.
You have access to the file structure and dependency graph of the user's project.
Answer questions about why certain files exist, how modules connect, or where specific logic should reside.
Keep answers tied to the visual structure provided.
`;

const CODE_GEN_SYSTEM_INSTRUCTION = `
You are an expert full-stack developer. Your task is to write the implementation code for a specific file in a software project.
You will be given the file's metadata, the project context, and a list of related files (dependencies).
- Write clean, production-ready code.
- Include comments explaining complex logic.
- Mock external imports if the code is not provided, but use realistic import paths based on the project structure.
- Do not output markdown code blocks (like \`\`\`typescript), just output the raw code text.
`;

// Models
const chatModel = 'gemini-2.5-flash';
const genModel = 'gemini-2.5-flash';
const codingModel = 'gemini-3-pro-preview'; // Better for coding tasks

let activeChat: Chat | null = null;
let blueprintChat: Chat | null = null;

export const initArchitectChat = () => {
  activeChat = ai.chats.create({
    model: chatModel,
    config: {
      systemInstruction: ARCHITECT_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
    },
  });
  return activeChat;
};

export const sendMessageToArchitect = async (message: string): Promise<string> => {
  if (!activeChat) {
    initArchitectChat();
  }
  if (!activeChat) throw new Error("Chat initialization failed");

  try {
    const result = await activeChat.sendMessage({ message });
    return result.text || "{}";
  } catch (error: any) {
    console.error("Architect Error:", error);
    throw error;
  }
};

export const generateProjectBlueprint = async (projectSummary: string, language: string, finalComment?: string): Promise<GraphData> => {
  
  const finalInstruction = finalComment ? `\n\nUSER FINAL INSTRUCTIONS/OVERRIDES: ${finalComment}` : "";

  try {
    const response = await ai.models.generateContent({
      model: genModel,
      contents: `Generate the architectural file map for this project using ${language}. Context: ${projectSummary} ${finalInstruction}`,
      config: {
        systemInstruction: BLUEPRINT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Unique ID (path based preferred)" },
                  name: { type: Type.STRING, description: "File or Folder name" },
                  type: { type: Type.STRING, enum: [FileType.FILE, FileType.FOLDER, FileType.SERVICE] },
                  description: { type: Type.STRING, description: "Short purpose of this file" },
                  techStack: { type: Type.ARRAY, items: { type: Type.STRING } },
                  parentId: { type: Type.STRING, nullable: true, description: "ID of parent folder" }
                },
                required: ["id", "name", "type"]
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING, description: "ID of the importing file" },
                  target: { type: Type.STRING, description: "ID of the imported file" },
                  type: { type: Type.STRING, enum: ["IMPORT", "DEPENDENCY", "DATA_FLOW"] }
                },
                required: ["source", "target", "type"]
              }
            }
          },
          required: ["nodes", "links"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Failed to generate blueprint");
    
    return JSON.parse(text) as GraphData;
  } catch (e) {
    console.error("Blueprint Gen Error", e);
    throw e;
  }
};

export const generateFileCode = async (
  node: NodeData, 
  projectDescription: string, 
  contextFiles: string[]
): Promise<string> => {
  try {
    const prompt = `
      Project Description: ${projectDescription}
      
      File to implement: 
      - Name: ${node.name}
      - Path/ID: ${node.id}
      - Description: ${node.description}
      - Tech Stack: ${node.techStack?.join(', ')}
      
      Related Files (Dependencies/Context):
      ${contextFiles.join('\n')}
      
      Output ONLY the code for this file.
    `;

    const response = await ai.models.generateContent({
      model: codingModel,
      contents: prompt,
      config: {
        systemInstruction: CODE_GEN_SYSTEM_INSTRUCTION,
      }
    });

    return response.text || "// No code generated";
  } catch (e) {
    console.error(`Error generating code for ${node.name}`, e);
    throw e;
  }
}

export const initBlueprintChat = (graphData: GraphData) => {
  const context = JSON.stringify(graphData.nodes.map(n => ({ name: n.name, type: n.type, description: n.description })));
  blueprintChat = ai.chats.create({
    model: chatModel,
    config: {
      systemInstruction: BLUEPRINT_CHAT_INSTRUCTION + `\nProject Structure: ${context}`,
    },
  });
};

export const askBlueprintQuestion = async (question: string): Promise<string> => {
  if (!blueprintChat) throw new Error("Blueprint chat not initialized");
  const result = await blueprintChat.sendMessage({ message: question });
  return result.text || "I couldn't find an answer in the blueprint.";
};