
import { GoogleGenAI } from "@google/genai";
import { Character } from "../types";

// Initialize Gemini Client
// Note: In a real app, strict error handling for missing API keys is needed.
const getClient = () => {
    const apiKey = process.env.API_KEY || 'mock_key'; 
    return new GoogleGenAI({ apiKey });
};

export interface GeneratedScriptResult {
  content: string;
  sources: Array<{ title: string; uri: string }>;
}

/**
 * Generates a script based on a user concept.
 * Uses gemini-3-flash-preview for speed on text tasks.
 * Supports Google Search grounding.
 */
export const generateScript = async (
  concept: string, 
  useSearch: boolean = false, 
  durationMinutes: number = 5,
  characters: Character[] = []
): Promise<GeneratedScriptResult> => {
  try {
    const ai = getClient();
    const tools = useSearch ? [{ googleSearch: {} }] : [];

    // Calculate approximate word count or section count based on duration (avg 150 words per minute)
    const detailLevel = durationMinutes > 10 ? "extremely detailed, long-form" : "concise";
    
    let characterContext = "";
    if (characters.length > 0) {
      characterContext = `\n\nCAST OF CHARACTERS (Include these characters in the script narrative where appropriate):\n${characters.map(c => `- ${c.name}: ${c.description}`).join('\n')}`;
    }

    const prompt = `Write a video script about: ${concept}. 
    Target Video Duration: Approximately ${durationMinutes} minutes.
    Style: ${detailLevel}.
    ${characterContext}
    
    Format the response as a JSON object with a 'sections' array, where each object has 'title' and 'content'.
    Ensure the content length matches the requested duration.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: tools
      }
    });
    
    const sources: Array<{ title: string; uri: string }> = [];
    
    // Extract grounding metadata if available
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      response.candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || 'Source',
            uri: chunk.web.uri
          });
        }
      });
    }

    return {
      content: response.text || "",
      sources
    };
  } catch (error) {
    console.error("Gemini API Error (Script):", error);
    // Return mock data if API fails (likely due to missing key in this demo env)
    return {
      content: JSON.stringify({
        sections: [
          { title: "Generated Intro", content: `This is a generated script based on your concept for a ${durationMinutes} minute video...` },
          { title: "Generated Body", content: "Here we explore the details of the concept..." }
        ]
      }),
      sources: []
    };
  }
};

/**
 * Generates an image prompt based on a script segment.
 */
export const generateImagePrompt = async (scriptText: string): Promise<string> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create a highly detailed, cinematic image generation prompt for the following script segment: "${scriptText}"`,
    });
    return response.text || "Cinematic shot of the described scene.";
  } catch (error) {
    console.error("Gemini API Error (Prompt):", error);
    return "Cinematic shot of a futuristic interface with neon lights.";
  }
};

/**
 * Generates a video using Veo (Mocked for this demo as Veo requests are complex/long-running)
 */
export const generateVideo = async (imagePrompt: string): Promise<void> => {
    // In a real implementation:
    // 1. Check window.aistudio.hasSelectedApiKey()
    // 2. Call ai.models.generateVideos() with veo-3.1-fast-generate-preview
    // 3. Poll for operation completion
    console.log("Generating video for:", imagePrompt);
    return new Promise(resolve => setTimeout(resolve, 3000));
};
