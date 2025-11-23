
import { GoogleGenAI, Modality, Part } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const SIGN_LANGUAGE_PROMPT = "Translate the American Sign Language gesture in this image into English text. Provide only the translated text, with no extra formatting or explanations.";
const VIDEO_PROMPT = "This is a sequence of frames from a video showing American Sign Language. Analyze the sequence and provide a single, coherent translation of the signs performed. Provide only the translated text.";

export const analyzeImage = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    const imagePart = {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    };
    const textPart = { text: SIGN_LANGUAGE_PROMPT };
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    });
    return response.text;
  } catch (error) {
    console.error("Error analyzing image:", error);
    return "Error: Could not analyze the image.";
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
    if (!text) return null;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Say: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio || null;
    } catch (error) {
        console.error("Error generating speech:", error);
        return null;
    }
};

export const analyzeVideo = async (frames: { base64: string; mimeType: string }[]): Promise<string> => {
    try {
        const frameParts: Part[] = frames.map(frame => ({
            inlineData: {
                data: frame.base64,
                mimeType: frame.mimeType,
            },
        }));
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: [{ text: VIDEO_PROMPT }, ...frameParts] }
        });
        return response.text;
    } catch (error) {
        console.error("Error analyzing video:", error);
        return "Error: Could not analyze the video.";
    }
};

export const textToSignImage = async (text: string): Promise<string | null> => {
    try {
        // Step 1: Get a description of the sign
        const descriptionResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: `Describe the American Sign Language gesture for the word '${text}'. Provide a concise, clear description suitable for an image generation prompt.`
        });
        const description = descriptionResponse.text;

        // Step 2: Generate an image from the description
        const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{
                    text: `A clear, instructional, photorealistic image of a person performing the American Sign Language sign: ${description}`,
                }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of imageResponse.candidates[0].content.parts) {
            if (part.inlineData) {
                return part.inlineData.data;
            }
        }
        return null;

    } catch (error) {
        console.error("Error generating sign image:", error);
        return null;
    }
};

export const generateWithVeo = async (prompt: string, aspectRatio: '16:9' | '9:16' = '16:9'): Promise<string | null> => {
    try {
        // Ensure we use the latest key when calling Veo
        const currentAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        let operation = await currentAi.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '1080p',
                aspectRatio: aspectRatio
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await currentAi.operations.getVideosOperation({ operation: operation });
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (videoUri) {
            return `${videoUri}&key=${process.env.API_KEY}`;
        }
        return null;
    } catch (error) {
        console.error("Error generating video with Veo:", error);
        throw error;
    }
};
