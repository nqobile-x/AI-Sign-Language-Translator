import React, { useState, useRef, useEffect } from 'react';
import { textToSignImage } from '../services/geminiService';
import Spinner from './Spinner';

// Polyfill for SpeechRecognition
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const SpeechToSign: React.FC = () => {
    const [transcribedText, setTranscribedText] = useState<string>('');
    const [signImageUrl, setSignImageUrl] = useState<string | null>(null);
    const [isListening, setIsListening] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (!SpeechRecognition) {
            setError('Speech recognition is not supported in this browser.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setTranscribedText(transcript);
            generateSign(transcript);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            if (event.error === 'no-speech') {
                setError("Sorry, I didn't catch that. Please try speaking again.");
            } else {
                setError(`Speech recognition error: ${event.error}`);
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };
        
        recognitionRef.current = recognition;

    }, []);

    const handleListen = () => {
        if (!recognitionRef.current) {
            setError('Speech recognition is not supported in this browser.');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setTranscribedText('');
            setSignImageUrl(null);
            setError('');
            setIsListening(true);
            recognitionRef.current.start();
        }
    };

    const generateSign = async (text: string) => {
        if (!text) return;
        setIsLoading(true);
        setError('');
        setSignImageUrl(null);
        try {
            const base64Image = await textToSignImage(text);
            if (base64Image) {
                setSignImageUrl(`data:image/png;base64,${base64Image}`);
            } else {
                setError('Could not generate an image for this text.');
            }
        } catch (err) {
            console.error(err);
            setError('An error occurred while generating the sign image.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 flex flex-col items-center">
            <p className="text-center text-gray-400">Click the microphone and speak a word or short phrase to see its sign language equivalent.</p>
            
            <button
                onClick={handleListen}
                className={`p-6 rounded-full transition-all duration-300 ${isListening ? 'bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v3m0 0h-2m2 0h2M5 11a7 7 0 0114 0" />
                </svg>
            </button>
            <p className="text-lg h-6">{isListening ? 'Listening...' : 'Click to speak'}</p>

            {error && <p className="text-red-400 text-center">{error}</p>}
            
            {transcribedText && (
                 <div className="w-full bg-gray-700/50 p-4 rounded-lg text-center">
                    <h3 className="text-lg font-semibold text-blue-300">You said:</h3>
                    <p className="text-2xl font-mono p-2">{transcribedText}</p>
                </div>
            )}

            <div className="w-full md:w-2/3 lg:w-1/2 aspect-square bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600">
                {isLoading ? (
                    <Spinner message="Generating sign image..." />
                ) : signImageUrl ? (
                    <img src={signImageUrl} alt={`Sign for ${transcribedText}`} className="w-full h-full object-contain rounded-lg" />
                ) : (
                    <p className="text-gray-400">Sign image will appear here</p>
                )}
            </div>
        </div>
    );
};

export default SpeechToSign;