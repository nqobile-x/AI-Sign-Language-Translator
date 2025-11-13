
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeImage, generateSpeech } from '../services/geminiService';
import { fileToBase64 } from '../utils/helpers';
import { decode, decodeAudioData } from '../utils/helpers';
import Spinner from './Spinner';
import { CameraIcon, VolumeUpIcon } from './IconComponents';

const SignToSpeech: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [useCamera, setUseCamera] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access the camera. Please check permissions and try again.");
      setUseCamera(false);
    }
  }, []);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
      setUseCamera(false);
      setTranslatedText('');
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setImageSrc(dataUrl);
        
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
      setError('Please select an image or capture one from the camera.');
      return;
    }
    setIsLoading(true);
    setError('');
    setTranslatedText('');

    try {
      const base64Image = await fileToBase64(file);
      const result = await analyzeImage(base64Image, file.type);
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
          <div className="w-full aspect-video bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-600">
            {useCamera ? (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : imageSrc ? (
              <img src={imageSrc} alt="Sign language gesture" className="w-full h-full object-contain" />
            ) : (
              <p className="text-gray-400">Your image will appear here</p>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <button onClick={() => setUseCamera(!useCamera)} className="flex-1 text-center py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors duration-300 flex items-center justify-center">
              {useCamera ? 'Close Camera' : 'Open Camera'}
            </button>
            <label htmlFor="file-upload" className="flex-1 cursor-pointer text-center py-3 px-4 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors duration-300">
              Upload Image
            </label>
            <input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>
          {useCamera && <button onClick={captureImage} className="w-full py-3 px-4 bg-teal-500 hover:bg-teal-600 rounded-lg font-semibold transition-colors duration-300">Capture</button>}
        </div>

        <div className="flex flex-col space-y-4">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !file}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors duration-300"
          >
            {isLoading ? 'Translating...' : 'Translate Sign'}
          </button>

          {error && <p className="text-red-400 text-center">{error}</p>}

          {isLoading && <Spinner message="Analyzing gesture..." />}
          
          {translatedText && (
            <div className="bg-gray-700/50 p-4 rounded-lg space-y-3">
              <h3 className="text-lg font-semibold text-blue-300">Translation:</h3>
              <p className="text-2xl font-mono p-4 bg-gray-900 rounded-md">{translatedText}</p>
              <button
                onClick={handleSpeak}
                disabled={isSpeaking}
                className="w-full flex items-center justify-center py-2 px-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-500 rounded-lg font-semibold transition-colors duration-300"
              >
                <VolumeUpIcon className="w-5 h-5 mr-2"/>
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
