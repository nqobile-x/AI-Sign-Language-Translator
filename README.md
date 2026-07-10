# AI Sign Language Translator

Two-way translation between sign language and spoken language, powered by Gemini: sign in front of a camera and hear speech, or speak and see the signs.

<!-- SCREENSHOT PLACEHOLDER: add a screenshot of the live translation view here -->

## Overview

Communication between deaf and hearing people usually depends on one side knowing the other's language, or on a human interpreter being available. This project explores how far multimodal AI can close that gap in the browser. It translates in both directions: sign language captured as images, uploaded video, or a live camera feed is turned into text and spoken audio, and spoken or typed language is turned into generated sign language imagery.

## Key features

- **Sign to Speech**: upload a photo or video of signing (or capture from camera), get the translated text, and play it back as generated speech
- **Video Understanding**: upload a longer video and get a full translation, with frames extracted client-side and analysed together
- **Live Video**: a real-time session over the Gemini Live API that streams your camera and microphone and returns live captions and audio
- **Speech to Sign**: speak (via the browser's SpeechRecognition API) or type, and get an AI-generated image showing how to sign the phrase
- **Generate Video**: create sign-language-themed video clips with the Veo model in 16:9 or 9:16

## Tech stack

- React 19 + TypeScript
- Vite 6
- `@google/genai` (Gemini multimodal analysis, speech generation, Live API, Veo, image generation)
- Web Speech API (speech recognition), Web Audio API, canvas-based frame extraction

## How it works

Each translation direction is a tab in a single-page React app. `services/geminiService.ts` holds all model calls: image and video analysis for sign reading, text-to-speech synthesis for the audio output, image generation for speech-to-sign, and Veo for video generation. Video files never leave the browser whole; `utils/helpers.ts` draws frames onto a canvas and sends a sampled set of frames to the model instead. The live mode encodes microphone and camera input into a streaming Live API session and decodes the audio replies through the Web Audio API.

## Setup

Prerequisites: Node.js and a Gemini API key.

1. `npm install`
2. Create `.env.local`:
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. `npm run dev` and open http://localhost:3000

Camera and microphone features need browser permission when first used. Veo video generation requires a paid Gemini API key.

## Usage

Start on the Sign to Speech tab: upload a clear photo of a sign or a short clip of signing, run the translation, then press play to hear it. For a conversation, use Live Video and allow camera and microphone access.

## What I learned

Video is expensive to send to a model, so the frame extraction pipeline mattered: sampling frames via canvas keeps requests small while preserving enough motion for the model to read the signs. Working with three different audio paths in one app (speech recognition in, synthesized speech out, and live streamed audio) also taught me to keep each pipeline isolated so one could fail without breaking the others.

## Contact

Portfolio: [nqobile-x.github.io/Nqobille](https://nqobile-x.github.io/Nqobille/)
