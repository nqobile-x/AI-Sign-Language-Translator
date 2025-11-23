
import React, { useState, useRef } from 'react';
import { analyzeVideo } from '../services/geminiService';
import { fileToDataUrl, extractFrames } from '../utils/helpers';
import Spinner from './Spinner';

const VideoToText: React.FC = () => {
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [translatedText, setTranslatedText] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            const dataUrl = await fileToDataUrl(selectedFile);
            setVideoSrc(dataUrl);
            setTranslatedText('');
            setError('');
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            setError('Please select a video file.');
            return;
        }
        setIsLoading(true);
        setError('');
        setTranslatedText('');

        try {
            if (!videoRef.current || !canvasRef.current) {
                setError('Video or canvas element not found.');
                setIsLoading(false);
                return;
            }
            const frames = await extractFrames(videoRef.current, canvasRef.current);
            if (frames.length === 0) {
                setError('Could not extract frames from the video.');
                setIsLoading(false);
                return;
            }
            const result = await analyzeVideo(frames);
            setTranslatedText(result);
        } catch (err) {
            console.error(err);
            setError('An error occurred during video analysis.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-4">
                 <h2 className="text-2xl font-bold text-blue-300">Video Understanding</h2>
                 <p className="text-gray-400 mt-2">Upload a video of sign language (or any content) for advanced analysis using Gemini 1.5 Pro.</p>
            </div>
           
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-full aspect-video bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-600">
                        {videoSrc ? (
                            <video ref={videoRef} src={videoSrc} controls className="w-full h-full object-contain" />
                        ) : (
                            <p className="text-gray-400">Your video will appear here</p>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                    <label htmlFor="video-upload" className="w-full cursor-pointer text-center py-3 px-4 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors duration-300">
                        Upload Video
                    </label>
                    <input id="video-upload" type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                </div>

                <div className="flex flex-col space-y-4">
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !file}
                        className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors duration-300"
                    >
                        {isLoading ? 'Analyzing Video...' : 'Analyze Video'}
                    </button>
                    {error && <p className="text-red-400 text-center">{error}</p>}
                    {isLoading && <Spinner message="Analyzing video frames... This uses the advanced Pro model." />}
                    {translatedText && (
                        <div className="bg-gray-700/50 p-4 rounded-lg">
                            <h3 className="text-lg font-semibold text-blue-300">Analysis Result:</h3>
                            <p className="text-lg font-mono p-4 bg-gray-900 rounded-md whitespace-pre-wrap">{translatedText}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoToText;
