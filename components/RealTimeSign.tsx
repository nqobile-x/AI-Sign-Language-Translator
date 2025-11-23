
import React, { useRef, useState, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData, encode } from '../utils/helpers';
import { textToSignImage } from '../services/geminiService';
import { CameraIcon } from './IconComponents';

const RealTimeSign: React.FC = () => {
    const [connected, setConnected] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [error, setError] = useState<string>('');
    const [liveCaption, setLiveCaption] = useState<string>('');
    const [isRecording, setIsRecording] = useState(false);
    const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
    
    // Sign Interpretation State
    const [interpretationText, setInterpretationText] = useState<string>('');
    const [signImage, setSignImage] = useState<string | null>(null);
    const [isGeneratingSign, setIsGeneratingSign] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const recordingCanvasRef = useRef<HTMLCanvasElement>(null);
    const signImageRef = useRef<HTMLImageElement>(null); // Ref for the image element to draw from

    const frameIntervalRef = useRef<number | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    
    // Transcription refs (need refs for the recording loop to access latest state without closure issues)
    const currentInputTranscription = useRef<string>('');
    const currentOutputTranscription = useRef<string>('');
    const captionRef = useRef<string>(''); 
    
    // Audio Context Refs
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const outputNodeRef = useRef<GainNode | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    
    // Recording Refs
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null); // Keep track of the camera stream
    
    // Playback cursor
    const nextStartTimeRef = useRef<number>(0);

    const API_KEY = process.env.API_KEY;

    const addLog = (message: string) => {
        setLogs((prev) => [message, ...prev].slice(0, 5));
    };

    const updateSignInterpretation = async (text: string) => {
        if (!text || text.trim().length < 2) return;
        
        setInterpretationText(text);
        setIsGeneratingSign(true);
        try {
            const base64Image = await textToSignImage(text);
            if (base64Image) {
                setSignImage(`data:image/png;base64,${base64Image}`);
            }
        } catch (err) {
            console.error("Error generating sign interpretation:", err);
        } finally {
            setIsGeneratingSign(false);
        }
    };

    const stopAudio = () => {
        if (outputAudioContextRef.current) {
            outputAudioContextRef.current.suspend();
        }
        sourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) {}
        });
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
    };

    const disconnect = () => {
        setConnected(false);
        setIsStreaming(false);
        setLogs((prev) => prev.filter(l => l !== 'Initializing...'));
        setLiveCaption('');
        captionRef.current = '';
        
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }

        if (isRecording) {
            stopRecording();
        }

        stopAudio();

        if (inputAudioContextRef.current) {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current) {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
        
        // Stop video stream tracks
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        streamRef.current = null;

        sessionPromiseRef.current = null;
    };

    const startRecording = () => {
        if (!videoRef.current || !recordingCanvasRef.current || !streamRef.current) return;
        
        setRecordedVideoUrl(null);
        chunksRef.current = [];
        
        const canvas = recordingCanvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return;

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Create stream from canvas (30fps)
        const canvasStream = canvas.captureStream(30);
        
        // Add audio track from microphone
        const audioTracks = streamRef.current.getAudioTracks();
        if (audioTracks.length > 0) {
            canvasStream.addTrack(audioTracks[0]);
        }

        const recorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });
        
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            setRecordedVideoUrl(url);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };

        recorder.start();
        recorderRef.current = recorder;
        setIsRecording(true);

        // Start drawing loop
        const draw = () => {
            if (!video || !ctx) return;
            
            // 1. Draw Video
            ctx.save();
            ctx.scale(-1, 1); // Mirror flip
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            ctx.restore();

            // 2. Draw Sign Language Image Overlay (Top Right)
            // Use the DOM ref to get the current image source directly
            const signImgEl = signImageRef.current;
            if (signImgEl && signImgEl.complete && signImgEl.naturalHeight !== 0) {
                 const overlayWidth = canvas.width * 0.25; // 25% width
                 const overlayHeight = overlayWidth * (signImgEl.naturalHeight / signImgEl.naturalWidth);
                 const padding = 10;
                 const x = canvas.width - overlayWidth - padding;
                 const y = padding;

                 // Draw Background for Overlay
                 ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                 ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)'; // purple border
                 ctx.lineWidth = 2;
                 ctx.beginPath();
                 ctx.roundRect(x - 5, y - 5, overlayWidth + 10, overlayHeight + 10, 8);
                 ctx.fill();
                 ctx.stroke();

                 // Draw Image
                 ctx.drawImage(signImgEl, x, y, overlayWidth, overlayHeight);
                 
                 // Draw Label
                 ctx.fillStyle = '#ffffff';
                 ctx.font = `bold ${Math.max(10, canvas.width/60)}px monospace`;
                 ctx.textAlign = 'center';
                 ctx.fillText("AI INTERPRETER", x + overlayWidth/2, y + overlayHeight + 15);
            }

            // 3. Draw Caption Overlay (Bottom Center)
            if (captionRef.current) {
                const text = captionRef.current;
                const fontSize = Math.max(24, canvas.width / 30);
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                
                // Text Background
                const padding = 20;
                const textWidth = ctx.measureText(text).width;
                const x = canvas.width / 2;
                const y = canvas.height - 40;
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.beginPath();
                ctx.roundRect(x - textWidth/2 - padding, y - fontSize - padding/2, textWidth + padding*2, fontSize + padding, 10);
                ctx.fill();

                // Text
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 4;
                ctx.fillText(text, x, y);
            }

            animationFrameRef.current = requestAnimationFrame(draw);
        };
        
        draw();
    };

    const stopRecording = () => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const connectToGemini = async () => {
        if (!API_KEY) {
            setError("API Key not found.");
            return;
        }
        setError('');
        setLogs(['Initializing...']);

        try {
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            
            // Setup Audio Contexts
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            // Important: Resume contexts as they might be suspended by browser policy
            await inputCtx.resume();
            await outputCtx.resume();

            inputAudioContextRef.current = inputCtx;
            outputAudioContextRef.current = outputCtx;
            outputNodeRef.current = outputCtx.createGain();
            outputNodeRef.current.connect(outputCtx.destination);
            
            // Get User Media (Video & Audio)
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user', width: 1280, height: 720 },
                audio: true 
            });
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            const config = {
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setConnected(true);
                        setIsStreaming(true);
                        // Clear initializing message and show connected
                        setLogs((prev) => ['Connected! Say "Hello" or sign.', ...prev.filter(l => l !== 'Initializing...')]);

                        // 1. Setup Audio Input Streaming
                        const source = inputCtx.createMediaStreamSource(stream);
                        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            
                            // Convert Float32 to Int16 PCM
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmData = encode(new Uint8Array(int16.buffer));
                            
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session: any) => {
                                    session.sendRealtimeInput({
                                        media: {
                                            mimeType: 'audio/pcm;rate=16000',
                                            data: pcmData
                                        }
                                    });
                                }).catch((e: any) => {
                                    console.error("Error sending audio:", e);
                                });
                            }
                        };
                        
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputCtx.destination);

                        // 2. Setup Video Frame Streaming
                        const canvas = canvasRef.current;
                        const video = videoRef.current;
                        
                        if (canvas && video) {
                            const ctx = canvas.getContext('2d');
                            frameIntervalRef.current = window.setInterval(async () => {
                                if (!sessionPromiseRef.current) return;
                                if (video.videoWidth === 0 || video.videoHeight === 0) return;
                                
                                canvas.width = video.videoWidth * 0.5; // Scale down for performance
                                canvas.height = video.videoHeight * 0.5;
                                ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
                                
                                const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                                
                                sessionPromiseRef.current?.then((session: any) => {
                                    session.sendRealtimeInput({
                                        media: {
                                            mimeType: 'image/jpeg',
                                            data: base64Data
                                        }
                                    });
                                }).catch((e: any) => {
                                     console.error("Error sending video frame:", e);
                                });

                            }, 500); // 2 FPS
                        }
                    },
                    onmessage: async (message: LiveServerMessage) => {
                         // Handle Audio Output
                        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            if (outputAudioContextRef.current && outputNodeRef.current) {
                                nextStartTimeRef.current = Math.max(
                                    nextStartTimeRef.current,
                                    outputAudioContextRef.current.currentTime
                                );

                                const audioBuffer = await decodeAudioData(
                                    decode(base64Audio),
                                    outputAudioContextRef.current,
                                    24000,
                                    1
                                );
                                
                                const source = outputAudioContextRef.current.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputNodeRef.current);
                                source.addEventListener('ended', () => {
                                    sourcesRef.current.delete(source);
                                });
                                
                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                sourcesRef.current.add(source);
                            }
                        }

                         // Handle Text Transcription (for UI log and overlay)
                        if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
                            const text = message.serverContent.modelTurn.parts[0].text;
                            addLog(`AI: ${text}`);
                        }
                        
                         // Handle Input/Output Transcription if enabled in config
                        if (message.serverContent?.outputTranscription) {
                            const text = message.serverContent.outputTranscription.text;
                            currentOutputTranscription.current += text;
                            captionRef.current += text;
                            setLiveCaption(captionRef.current);
                        }
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscription.current += message.serverContent.inputTranscription.text;
                        }
                        
                        if (message.serverContent?.turnComplete) {
                            // Turn Complete - Determine what to interpret for signs
                            let fullTextToTranslate = '';

                            if (currentOutputTranscription.current) {
                                addLog(`Translation: ${currentOutputTranscription.current}`);
                                fullTextToTranslate = currentOutputTranscription.current;
                                currentOutputTranscription.current = '';
                                
                                setTimeout(() => {
                                    if (captionRef.current === liveCaption) { 
                                        // Optional clear
                                    }
                                }, 5000);
                                captionRef.current = ''; 
                                setLiveCaption('');
                            }
                            
                            if (currentInputTranscription.current) {
                                // Also interpret user input if available
                                fullTextToTranslate = currentInputTranscription.current;
                                currentInputTranscription.current = '';
                            }

                            // Trigger Sign Image Generation
                            if (fullTextToTranslate) {
                                updateSignInterpretation(fullTextToTranslate);
                            }
                        }
                    },
                    onclose: () => {
                        setConnected(false);
                        setIsStreaming(false);
                        addLog("Connection closed.");
                        setLiveCaption("");
                    },
                    onerror: (e: any) => {
                        console.error("Gemini API Error:", e);
                        setError("Connection error: " + (e.message || "Unknown error"));
                        setConnected(false);
                        setIsStreaming(false);
                    }
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                    },
                    // Enable transcription with empty objects as per documentation
                    inputAudioTranscription: {}, 
                    outputAudioTranscription: {},
                    systemInstruction: `You are a real-time American Sign Language (ASL) interpreter. 
                    When the session starts, briefly say "I am ready to translate" to confirm audio is working.
                    1. VISUAL: Continuously watch the user. If they perform ASL signs, immediately translate them into spoken English. Be concise.
                    2. AUDIO: If the user speaks to you (voice), answer their question briefly.
                    3. If nothing is happening, remain silent. Do not hallucinate signs.`,
                },
            };

            const sessionPromise = ai.live.connect(config);
            sessionPromiseRef.current = sessionPromise;

        } catch (err: any) {
            console.error(err);
            setError(`Failed to connect: ${err.message || 'Unknown error'}`);
            disconnect();
        }
    };
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
                <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-700 shadow-xl group">
                     <video 
                        ref={videoRef} 
                        className={`w-full h-full object-cover transform scale-x-[-1] ${!connected ? 'opacity-50' : ''}`} 
                        autoPlay 
                        playsInline 
                        muted 
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    {/* Hidden canvas for high-quality recording */}
                    <canvas ref={recordingCanvasRef} className="hidden" />
                    
                    {!connected && !error && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <p className="text-gray-400">Ready to connect</p>
                        </div>
                    )}
                    
                    {connected && (
                        <>
                             <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/60 px-3 py-1 rounded-full border border-red-500/30 z-20">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                                <span className="text-xs font-mono text-white tracking-wider">LIVE</span>
                            </div>

                            {/* Sign Interpretation Overlay (Top Right) */}
                            {/* We keep this image in DOM so the recorder can grab it, but also position it for user to see */}
                            <div className={`absolute top-4 right-4 w-1/4 max-w-[200px] bg-black/70 rounded-lg border border-purple-500/50 overflow-hidden transition-all duration-500 z-20 ${signImage || isGeneratingSign ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
                                <div className="bg-purple-900/40 px-2 py-1 text-[10px] text-purple-200 font-bold tracking-wider text-center border-b border-purple-500/20">
                                    AI INTERPRETER
                                </div>
                                <div className="aspect-square flex items-center justify-center p-2">
                                     {isGeneratingSign ? (
                                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                    ) : signImage ? (
                                        // The Ref is attached here so the Canvas Recorder can find this element
                                        <img ref={signImageRef} src={signImage} alt="Sign Interpretation" className="w-full h-full object-contain" crossOrigin="anonymous"/>
                                    ) : null}
                                </div>
                            </div>
                            
                            {/* Live Subtitle Overlay */}
                            <div className={`absolute bottom-8 left-0 right-0 flex justify-center transition-opacity duration-300 z-20 ${liveCaption ? 'opacity-100' : 'opacity-0'}`}>
                                <div className="bg-black/70 backdrop-blur-sm px-6 py-3 rounded-2xl max-w-[80%] text-center border border-white/10 shadow-2xl">
                                    <p className="text-white text-xl md:text-2xl font-semibold drop-shadow-md leading-relaxed">
                                        {liveCaption}
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Recording Indicator */}
                    {isRecording && (
                        <div className="absolute top-14 left-4 flex items-center space-x-2 bg-red-600/90 px-3 py-1 rounded-full animate-pulse z-20">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                            <span className="text-xs font-bold text-white uppercase">REC</span>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-4 w-full max-w-2xl justify-center">
                    {!connected ? (
                        <button 
                            onClick={connectToGemini}
                            className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-white transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center min-w-[200px]"
                        >
                            <span className="mr-2">●</span> Start Real-Time Translation
                        </button>
                    ) : (
                        <>
                            <button 
                                onClick={disconnect}
                                className="flex-1 py-3 px-6 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white transition-all shadow-lg flex items-center justify-center min-w-[150px]"
                            >
                                Stop Session
                            </button>
                            
                            {!isRecording ? (
                                <button
                                    onClick={startRecording}
                                    className="py-3 px-6 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-white transition-all flex items-center justify-center border border-gray-600 hover:border-gray-500"
                                >
                                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                                    Record Video
                                </button>
                            ) : (
                                <button
                                    onClick={stopRecording}
                                    className="py-3 px-6 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-white transition-all flex items-center justify-center border border-gray-600 hover:border-gray-500"
                                >
                                    <div className="w-3 h-3 bg-white rounded-sm mr-2"></div>
                                    Stop Recording
                                </button>
                            )}
                        </>
                    )}
                </div>
                
                {/* Download Link */}
                {recordedVideoUrl && (
                    <div className="w-full max-w-md bg-green-900/30 border border-green-500/50 rounded-lg p-4 flex items-center justify-between animate-fade-in">
                        <span className="text-green-200 text-sm font-medium">Session recorded successfully!</span>
                        <a 
                            href={recordedVideoUrl} 
                            download={`sign-language-session-${new Date().toISOString()}.webm`}
                            className="bg-green-600 hover:bg-green-500 text-white text-sm py-2 px-4 rounded transition-colors shadow-lg shadow-green-600/20"
                        >
                            Download Video
                        </a>
                    </div>
                )}

                {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg w-full max-w-md text-center">
                        {error}
                    </div>
                )}
                
                {connected && (
                     <div className="w-full max-w-2xl bg-gray-800 rounded-xl p-4 border border-gray-700 h-40 overflow-y-auto custom-scrollbar scroll-smooth">
                        <div className="flex justify-between items-center mb-2">
                            <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">Session Transcript</div>
                            <div className="flex space-x-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                <span className="text-xs text-green-500 font-semibold">Active</span>
                            </div>
                        </div>
                        <div className="space-y-1.5 font-mono text-sm">
                            {logs.map((log, i) => (
                                <div key={i} className={`p-1.5 rounded ${log.startsWith('AI:') || log.startsWith('Translation:') ? 'bg-blue-900/20 text-blue-200 border-l-2 border-blue-500' : 'text-gray-400'}`}>
                                    {log}
                                </div>
                            ))}
                            {logs.length === 0 && <span className="text-gray-600 italic">Waiting for signs...</span>}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="text-center text-sm text-gray-500 max-w-2xl mx-auto">
                <p>Ensure you are in a well-lit environment. Perform ASL signs clearly towards the camera. The AI will speak the translation and subtitles will appear on screen.</p>
            </div>
        </div>
    );
};

export default RealTimeSign;
