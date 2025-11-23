
import React, { useState, useRef, useEffect } from 'react';
import { textToSignImage } from '../services/geminiService';
import Spinner from './Spinner';

// Polyfill for SpeechRecognition
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const SpeechToSign: React.FC = () => {
    const [inputText, setInputText] = useState<string>('');
    const [generatedForText, setGeneratedForText] = useState<string>('');
    const [signImageUrl, setSignImageUrl] = useState<string | null>(null);
    const [isListening, setIsListening] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (!SpeechRecognition) {
            setError('Speech recognition is not supported in this browser. Please use the text input below.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            setInputText(transcript);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            if (event.error === 'no-speech') {
                setError("Sorry, I didn't catch that. Please try speaking again, perhaps louder or closer to the mic.");
            } else if (event.error === 'not-allowed') {
                 setError("Microphone access denied. Please allow microphone access in your browser's site settings.");
            }
            else {
                setError(`Speech recognition error: ${event.error}. You can use the text input instead.`);
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };
        
        recognitionRef.current = recognition;

    }, []);

    const handleListen = () => {
        if (!recognitionRef.current || !SpeechRecognition) {
            setError('Speech recognition is not available. Please use the text input below.');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setInputText('');
            setSignImageUrl(null);
            setError('');
            setGeneratedForText('');
            setIsListening(true);
            recognitionRef.current.start();
        }
    };

    const handleGenerateSign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) {
            setError("Please enter or speak some text to translate.");
            return;
        };
        
        setGeneratedForText('');
        setIsLoading(true);
        setError('');
        setSignImageUrl(null);

        try {
            const base64Image = await textToSignImage(inputText);
            if (base64Image) {
                setSignImageUrl(`data:image/png;base64,${base64Image}`);
                setGeneratedForText(inputText);
            } else {
                setError(`Could not generate an image for "${inputText}".`);
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
            <p className="text-center text-gray-400">Click the microphone to speak, or type a word/phrase. Then click "Generate Sign".</p>
            
            <div className="flex flex-col items-center space-y-2">
                 <button
                    onClick={handleListen}
                    disabled={!SpeechRecognition}
                    className={`p-6 rounded-full transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed ${isListening ? 'bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}
                    aria-label={isListening ? 'Stop listening' : 'Start listening'}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v3m0 0h-2m2 0h2M5 11a7 7 0 0114 0" />
                    </svg>
                </button>
                <p className="text-lg h-6">{isListening ? 'Listening...' : (SpeechRecognition ? 'Click to speak' : 'Mic not available')}</p>
            </div>

            <div className="w-full max-w-lg my-2 flex items-center">
                <span className="flex-grow border-t border-gray-700"></span>
                <span className="mx-4 text-gray-500">THEN</span>
                <span className="flex-grow border-t border-gray-700"></span>
            </div>

            <form onSubmit={handleGenerateSign} className="w-full max-w-lg flex flex-col sm:flex-row gap-2">
                <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => {
                        setInputText(e.target.value);
                        if (signImageUrl) setSignImageUrl(null);
                        if (generatedForText) setGeneratedForText('');
                    }}
                    placeholder="Text will appear here after speaking..."
                    className="flex-grow bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                    type="submit"
                    disabled={!inputText.trim() || isLoading}
                    className="py-3 px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 rounded-lg font-semibold transition-colors duration-300"
                >
                    Generate Sign
                </button>
            </form>

            {error && <p className="text-red-400 text-center">{error}</p>}
            
            {generatedForText && !isLoading && (
                 <div className="w-full max-w-lg bg-gray-700/50 p-4 rounded-lg text-center">
                    <h3 className="text-lg font-semibold text-blue-300">Displaying sign for:</h3>
                    <p className="text-2xl font-mono p-2 break-words">{generatedForText}</p>
                </div>
            )}

            <div className="w-full md:w-2/3 lg:w-1/2 aspect-square bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600">
                {isLoading ? (
                    <Spinner message="Generating sign image..." />
                ) : signImageUrl ? (
                    <img src={signImageUrl} alt={`Sign for ${generatedForText}`} className="w-full h-full object-contain rounded-lg" />
                ) : (
                    <p className="text-gray-400">Sign image will appear here</p>
                )}
            </div>
        </div>
    );
};

export default SpeechToSign;