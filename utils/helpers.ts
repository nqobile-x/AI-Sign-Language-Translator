
// Base64 decoding function
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Base64 encoding function for Uint8Array
export function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Function to decode raw PCM audio data into an AudioBuffer
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

export const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });

export const extractFrames = (videoEl: HTMLVideoElement, canvasEl: HTMLCanvasElement): Promise<{ base64: string; mimeType: string }[]> => {
    return new Promise((resolve) => {
        if (!videoEl || !canvasEl) return resolve([]);
        
        const context = canvasEl.getContext('2d');
        const frames: { base64: string; mimeType: string }[] = [];
        const interval = 0.5; // seconds, 2 frames per second
        
        const onSeeked = () => {
            if (!context) return;
            
            canvasEl.width = videoEl.videoWidth;
            canvasEl.height = videoEl.videoHeight;
            context.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
            const dataUrl = canvasEl.toDataURL('image/jpeg');
            frames.push({
                base64: dataUrl.split(',')[1],
                mimeType: 'image/jpeg'
            });

            if (videoEl.currentTime < videoEl.duration) {
                videoEl.currentTime += interval;
            } else {
                videoEl.removeEventListener('seeked', onSeeked);
                resolve(frames);
            }
        };
        
        const onLoadedMetadata = () => {
            videoEl.addEventListener('seeked', onSeeked);
            videoEl.currentTime = 0.1; // Start seeking
        };

        videoEl.currentTime = 0;
        if (videoEl.readyState >= 1) { // METADATA_LOADED or more
             onLoadedMetadata();
        } else {
            videoEl.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        }
    });
};
