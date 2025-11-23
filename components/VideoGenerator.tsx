
import React, { useState } from 'react';
import { generateWithVeo } from '../services/geminiService';
import Spinner from './Spinner';

const VideoGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        
        // 1. Check for API Key selection for Veo
        try {
             const aiStudio = (window as any).aistudio;
             if (aiStudio && aiStudio.hasSelectedApiKey) {
                const hasKey = await aiStudio.hasSelectedApiKey();
                if (!hasKey) {
                    await aiStudio.openSelectKey();
                    // Assume success or user cancellation. 
                    // To be safe, we can check again or just proceed and handle the error if it fails.
                }
             }
        } catch (e) {
            console.warn("Could not check/request API key selection", e);
        }

        setIsLoading(true);
        setError('');
        setVideoUrl(null);

        try {
            const url = await generateWithVeo(prompt, aspectRatio);
            if (url) {
                setVideoUrl(url);
            } else {
                setError("Failed to generate video. No URL returned.");
            }
        } catch (err: any) {
            console.error(err);
             if (err.message && err.message.includes("Requested entity was not found")) {
                 setError("API Key issue detected. Please try selecting your key again.");
                 try {
                     const aiStudio = (window as any).aistudio;
                     if (aiStudio && aiStudio.openSelectKey) {
                         await aiStudio.openSelectKey();
                     }
                 } catch (e) {}
             } else {
                setError(`Error: ${err.message || "An unexpected error occurred."}`);
             }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
                    Generative Video
                </h2>
                <p className="text-gray-400">
                    Create videos from text prompts using the Veo model.
                    <br />
                    <span className="text-xs text-gray-500">Requires a paid project API key.</span>
                </p>
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">Billing Information</a>
            </div>

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Prompt</label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe the video you want to generate (e.g., A cinematic shot of a futuristic robot learning sign language)"
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent h-32 resize-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setAspectRatio('16:9')}
                            className={`flex-1 py-2 px-4 rounded-lg border ${aspectRatio === '16:9' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-900 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Landscape (16:9)
                        </button>
                        <button
                            onClick={() => setAspectRatio('9:16')}
                            className={`flex-1 py-2 px-4 rounded-lg border ${aspectRatio === '9:16' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-900 border-gray-600 text-gray-400 hover:bg-gray-700'}`}
                        >
                            Portrait (9:16)
                        </button>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isLoading || !prompt.trim()}
                    className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-white transition-all shadow-lg"
                >
                    {isLoading ? 'Generating Video...' : 'Generate Video'}
                </button>
            </div>

            {error && (
                <div className="bg-red-900/30 border border-red-500/50 p-4 rounded-lg text-red-200 text-center text-sm">
                    {error}
                </div>
            )}

            {isLoading && (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-800/50 rounded-xl border border-dashed border-gray-700">
                    <Spinner message="Creating your video with Veo... This may take a minute." />
                </div>
            )}

            {videoUrl && !isLoading && (
                <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-2xl animate-fade-in">
                    <video
                        src={videoUrl}
                        controls
                        autoPlay
                        loop
                        className="w-full h-auto max-h-[600px] object-contain mx-auto"
                    />
                    <div className="p-4 bg-gray-900 flex justify-between items-center">
                         <span className="text-gray-400 text-sm">Generated with Veo</span>
                         <a 
                            href={videoUrl} 
                            download="veo-generation.mp4"
                            className="text-purple-400 hover:text-purple-300 text-sm font-semibold"
                        >
                            Download MP4
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoGenerator;
