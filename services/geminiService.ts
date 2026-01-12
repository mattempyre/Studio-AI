
import { GoogleGenAI, Type } from "@google/genai";
import { Character } from "../types";

// Helper to access window.aistudio safely
const getAiStudio = () => (typeof window !== 'undefined' ? (window as any).aistudio : null);

// Initialize Gemini Client
const getClient = () => {
    // The API key must be obtained exclusively from process.env.API_KEY
    const apiKey = process.env.API_KEY || ''; 
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
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  duration: { type: Type.STRING }
                },
                required: ['title', 'content']
              }
            }
          }
        },
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
      content: response.text || "{}",
      sources
    };
  } catch (error) {
    console.error("Gemini API Error (Script):", error);
    // Return empty JSON on failure to allow graceful handling in UI
    return {
      content: JSON.stringify({ sections: [] }),
      sources: []
    };
  }
};

/**
 * Generates an image based on a prompt.
 * Uses gemini-2.5-flash-image.
 */
export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      // No responseMimeType for this model
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Gemini API Error (Image):", error);
    throw error;
  }
};

/**
 * Generates an image prompt based on a script segment (Helper).
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
 * Generates a video using Veo.
 * Uses veo-3.1-fast-generate-preview.
 */
export const generateVideo = async (prompt: string): Promise<string> => {
    try {
        const aiStudio = getAiStudio();
        if (aiStudio) {
            if (!await aiStudio.hasSelectedApiKey()) {
                await aiStudio.openSelectKey();
            }
        }
        
        // Re-initialize client to ensure fresh key if selected via dialog
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        // Poll for completion
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({operation: operation});
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error("No video URI returned");

        // Append API Key for access
        return `${videoUri}&key=${process.env.API_KEY}`;
    } catch (error) {
        console.error("Gemini API Error (Video):", error);
        throw error;
    }
};

/**
 * Internal helper to write a string to a DataView
 */
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

/**
 * Internal helper to convert Base64 string to Uint8Array
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Internal helper to wrap raw PCM data with a WAV header.
 * Assumes 24kHz, 1 channel, 16-bit PCM (standard for Gemini TTS).
 */
const pcmToWav = (pcmData: Uint8Array, sampleRate: number = 24000): Blob => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, byteRate, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitsPerSample, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataSize, true);

  // Write PCM data
  const pcmBytes = new Uint8Array(buffer, 44);
  pcmBytes.set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
};

/**
 * Generates speech from text using Gemini TTS.
 * Returns a Blob URL for playback.
 */
export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO" as any], 
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data generated");
    
    // Convert raw PCM (base64) to WAV Blob URL
    const pcmData = base64ToUint8Array(base64Audio);
    const wavBlob = pcmToWav(pcmData, 24000); // 24kHz is default for Gemini TTS
    return URL.createObjectURL(wavBlob);

  } catch (error) {
    console.error("Gemini API Error (Speech):", error);
    throw error;
  }
};
