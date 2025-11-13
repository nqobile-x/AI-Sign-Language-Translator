
import React, { useState, useRef } from 'react';
import { analyzeVideo } from '../services/geminiService';
import { fileToDataUrl } from '../utils/helpers';
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

    const extractFrames = (): Promise<{ base64: string; mimeType: string }[]> => {
        return new Promise((resolve) => {
            if (!videoRef.current || !canvasRef.current) return resolve([]);
            
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            const frames: { base64: string; mimeType: string }[] = [];
            const interval = 0.5; // seconds, 2 frames per second
            
            video.currentTime = 0;
            
            video.onseeked = () => {
                if (!context) return;
                
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const dataUrl = canvas.toDataURL('image/jpeg');
                frames.push({
                    base64: dataUrl.split(',')[1],
                    mimeType: 'image/jpeg'
                });

                if (video.currentTime < video.duration) {
                    video.currentTime += interval;
                } else {
                    resolve(frames);
                }
            };
            
            video.onloadedmetadata = () => {
                video.currentTime = 0.1; // Start seeking
            };

            if (video.readyState >= 1) { // METADATA_LOADED or more
                 video.currentTime = 0.1;
            }
        });
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
            const frames = await extractFrames();
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
            <p className="text-center text-gray-400">Upload a short video (under 10 seconds recommended) of sign language for translation.</p>
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
                        {isLoading ? 'Analyzing Video...' : 'Translate Video'}
                    </button>
                    {error && <p className="text-red-400 text-center">{error}</p>}
                    {isLoading && <Spinner message="Analyzing video... this may take a moment." />}
                    {translatedText && (
                        <div className="bg-gray-700/50 p-4 rounded-lg">
                            <h3 className="text-lg font-semibold text-blue-300">Translation:</h3>
                            <p className="text-2xl font-mono p-4 bg-gray-900 rounded-md">{translatedText}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoToText;
