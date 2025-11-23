
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeImage, generateSpeech, analyzeVideo } from '../services/geminiService';
import { fileToBase64, decode, decodeAudioData, extractFrames, fileToDataUrl } from '../utils/helpers';
import Spinner from './Spinner';
import { CameraIcon, VolumeUpIcon } from './IconComponents';

const SignToSpeech: React.FC = () => {
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [useCamera, setUseCamera] = useState<boolean>(false);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access the camera. Please check permissions and try again.");
      setUseCamera(false);
    }
  }, []);

  const stopCamera = () => {
    if (cameraVideoRef.current && cameraVideoRef.current.srcObject) {
      const stream = cameraVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      cameraVideoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (useCamera) {
      startCamera();
    } else {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCamera]);

  useEffect(() => {
    return () => {
        stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      if (selectedFile.type.startsWith('image/')) {
          setMediaType('image');
      } else if (selectedFile.type.startsWith('video/')) {
          setMediaType('video');
      } else {
          setError("Unsupported file type. Please upload an image or video.");
          setMediaSrc(null);
          setMediaType(null);
          setFile(null);
          return;
      }
      
      const dataUrl = await fileToDataUrl(selectedFile);
      setMediaSrc(dataUrl);
      setUseCamera(false);
      setTranslatedText('');
      setError('');
    }
  };

  const captureImage = () => {
    if (cameraVideoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = cameraVideoRef.current.videoWidth;
        canvasRef.current.height = cameraVideoRef.current.videoHeight;
        context.drawImage(cameraVideoRef.current, 0, 0, cameraVideoRef.current.videoWidth, cameraVideoRef.current.videoHeight);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setMediaSrc(dataUrl);
        setMediaType('image');
        
        canvasRef.current.toBlob(blob => {
            if (blob) {
                setFile(new File([blob], "capture.jpg", { type: "image/jpeg" }));
            }
        }, 'image/jpeg');
        setUseCamera(false);
        setTranslatedText('');
      }
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select a file or capture one from the camera.');
      return;
    }
    setIsLoading(true);
    setError('');
    setTranslatedText('');

    try {
      let result = '';
      if (mediaType === 'video') {
        if (!previewVideoRef.current || !canvasRef.current) {
          setError("Video processing element not ready.");
          setIsLoading(false);
          return;
        }
        const frames = await extractFrames(previewVideoRef.current, canvasRef.current);
        if (frames.length === 0) {
          setError('Could not extract frames from the video.');
          setIsLoading(false);
          return;
        }
        result = await analyzeVideo(frames);
      } else { // 'image'
        const base64Image = await fileToBase64(file);
        result = await analyzeImage(base64Image, file.type);
      }
      setTranslatedText(result);
    } catch (err) {
      console.error(err);
      setError('An error occurred during translation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = async () => {
    if (!translatedText || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const audioData = await generateSpeech(translatedText);
      if (audioData) {
        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const decodedBytes = decode(audioData);
        const audioBuffer = await decodeAudioData(decodedBytes, outputAudioContext, 24000, 1);
        const source = outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContext.destination);
        source.start();
        source.onended = () => setIsSpeaking(false);
      } else {
        setError("Could not generate speech.");
        setIsSpeaking(false);
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred while playing audio.");
      setIsSpeaking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-full aspect-video bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-600 relative group">
            {useCamera ? (
                <>
                  <video ref={cameraVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute top-4 right-4 flex items-center space-x-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-red-500/30">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                    <span className="text-xs text-white font-bold tracking-wider">LIVE CAM</span>
                 </div>
                 <div className="absolute inset-0 border-2 border-red-500/20 pointer-events-none animate-pulse"></div>
                </>
            ) : mediaType === 'video' && mediaSrc ? (
               <video ref={previewVideoRef} src={mediaSrc} controls className="w-full h-full object-contain" />
            ) : mediaSrc ? (
              <img src={mediaSrc} alt="Sign language gesture" className="w-full h-full object-contain" />
            ) : (
              <p className="text-gray-400 group-hover:text-gray-300 transition-colors">Your image or video will appear here</p>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <button onClick={() => setUseCamera(!useCamera)} className="flex-1 text-center py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors duration-300 flex items-center justify-center">
              <CameraIcon className="w-5 h-5 mr-2" />
              {useCamera ? 'Close Camera' : 'Open Camera'}
            </button>
            <label htmlFor="file-upload" className="flex-1 cursor-pointer text-center py-3 px-4 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors duration-300 flex items-center justify-center">
              Upload File
            </label>
            <input id="file-upload" type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
          </div>
          {useCamera && <button onClick={captureImage} className="w-full py-3 px-4 bg-teal-500 hover:bg-teal-600 rounded-lg font-semibold transition-colors duration-300 shadow-lg shadow-teal-500/20">Capture Photo</button>}
        </div>

        <div className="flex flex-col space-y-4">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !file}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors duration-300 shadow-lg shadow-green-600/20"
          >
            {isLoading ? 'Translating...' : 'Translate Sign'}
          </button>

          {error && <p className="text-red-400 text-center bg-red-900/20 p-2 rounded border border-red-500/50">{error}</p>}

          {isLoading && <Spinner message={mediaType === 'video' ? "Analyzing video..." : "Analyzing gesture..."} />}
          
          {translatedText && (
            <div className={`bg-gray-700/50 p-4 rounded-lg space-y-3 transition-all duration-500 ${isSpeaking ? 'ring-2 ring-indigo-500 bg-gray-700/80 shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'border border-gray-600'}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-blue-300">Translation:</h3>
                {isSpeaking && (
                    <div className="flex items-center space-x-1">
                        <span className="text-xs text-indigo-300 mr-2 font-medium">PLAYING</span>
                        <div className="flex space-x-0.5 items-end h-4">
                            <span className="w-1 bg-indigo-400 animate-[bounce_1s_infinite] h-2 rounded-t-sm"></span>
                            <span className="w-1 bg-indigo-400 animate-[bounce_1s_infinite_0.1s] h-4 rounded-t-sm"></span>
                            <span className="w-1 bg-indigo-400 animate-[bounce_1s_infinite_0.2s] h-3 rounded-t-sm"></span>
                            <span className="w-1 bg-indigo-400 animate-[bounce_1s_infinite_0.1s] h-4 rounded-t-sm"></span>
                            <span className="w-1 bg-indigo-400 animate-[bounce_1s_infinite] h-2 rounded-t-sm"></span>
                        </div>
                    </div>
                )}
              </div>
              <p className="text-2xl font-mono p-4 bg-gray-900 rounded-md border-l-4 border-blue-500">{translatedText}</p>
              <button
                onClick={handleSpeak}
                disabled={isSpeaking}
                className={`w-full flex items-center justify-center py-2 px-4 rounded-lg font-semibold transition-all duration-300 ${isSpeaking ? 'bg-indigo-600/50 text-indigo-200 cursor-default' : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'}`}
              >
                <VolumeUpIcon className={`w-5 h-5 mr-2 ${isSpeaking ? 'animate-pulse' : ''}`}/>
                {isSpeaking ? 'Speaking...' : 'Speak Translation'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignToSpeech;
