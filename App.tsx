
import React, { useState } from 'react';
import { Tab } from './types';
import Tabs from './components/Tabs';
import SignToSpeech from './components/SignToSpeech';
import VideoToText from './components/VideoToText';
import SpeechToSign from './components/SpeechToSign';
import { DocumentScannerIcon, VideoLibraryIcon, AudioSparkIcon } from './components/IconComponents';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.SignToSpeech);

  const renderContent = () => {
    switch (activeTab) {
      case Tab.SignToSpeech:
        return <SignToSpeech />;
      case Tab.VideoToText:
        return <VideoToText />;
      case Tab.SpeechToSign:
        return <SpeechToSign />;
      default:
        return <SignToSpeech />;
    }
  };

  const tabs = [
    { id: Tab.SignToSpeech, label: 'Sign to Speech', icon: <DocumentScannerIcon /> },
    { id: Tab.VideoToText, label: 'Video to Text', icon: <VideoLibraryIcon /> },
    { id: Tab.SpeechToSign, label: 'Speech to Sign', icon: <AudioSparkIcon /> },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
      <header className="bg-gray-800/50 backdrop-blur-sm shadow-lg p-4 sticky top-0 z-10">
        <div className="container mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-300">
            AI Sign Language Translator
          </h1>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 md:p-6 max-w-5xl">
        <div className="mb-6">
          <Tabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-4 md:p-8">
          {renderContent()}
        </div>
      </main>

      <footer className="text-center p-4 text-xs text-gray-500">
        <p>Powered by Gemini. For informational purposes only.</p>
      </footer>
    </div>
  );
};

export default App;
