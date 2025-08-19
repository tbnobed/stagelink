// Global variables for SRS SDK and QR Code library
declare global {
  interface Window {
    SrsRtcWhipWhepAsync: any;
    SrsRtcFormatStats: any;
    parse_query_string: any;
    QRCode: any;
  }
}

let sdk: any = null;
let statsTimer: NodeJS.Timeout | null = null;

interface StreamingConfig {
  stream: string;
  returnStream: string;
  app: string;
}

let config: StreamingConfig = {
  stream: 'obed2',
  returnStream: 'obed2',
  app: 'live'
};

export function initializeStreaming(newConfig: Partial<StreamingConfig>) {
  config = { ...config, ...newConfig };
}

export async function startPublishing(videoElement: HTMLVideoElement | null): Promise<{ sessionId: string }> {
  if (!videoElement) {
    throw new Error('Video element is required');
  }

  if (!window.SrsRtcWhipWhepAsync) {
    throw new Error('SRS SDK not loaded');
  }

  // Clean up existing session
  if (statsTimer) clearInterval(statsTimer);
  if (sdk) sdk.close();

  sdk = new window.SrsRtcWhipWhepAsync();
  sdk.constraints = {
    video: {
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 }
    },
    audio: true
  };

  try {
    const url = `https://cdn2.obedtv.live:1990/rtc/v1/whip/?app=${config.app}&stream=${config.stream}`;
    await sdk.publish(url, {
      camera: true,
      screen: false,
      audio: true
    });

    videoElement.srcObject = sdk.stream;
    
    // Start stats collection
    if (window.SrsRtcFormatStats) {
      statsTimer = setInterval(() => {
        sdk.pc.getStats(null).then((stats: any) => {
          // Stats are handled by the session page component
        });
      }, 1000);
    }

    return { sessionId: sdk.sessionid || "Connected" };
  } catch (err) {
    sdk.close();
    throw err;
  }
}

export function stopPublishing() {
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }
  if (sdk) {
    sdk.close();
    sdk = null;
  }
}

export async function startPlayback(videoElement: HTMLVideoElement, streamName: string) {
  if (!window.SrsRtcWhipWhepAsync) {
    console.warn('SRS SDK not loaded, cannot start playback');
    return;
  }

  console.log('Starting playback for return feed:', streamName);

  try {
    const player = new window.SrsRtcWhipWhepAsync();
    
    // Set up event handlers
    player.ontrack = (event: any) => {
      console.log('Received track for stream:', streamName, event);
      if (event.streams && event.streams[0]) {
        videoElement.srcObject = event.streams[0];
      }
    };

    const url = `https://cdn2.obedtv.live:1990/rtc/v1/whep/?app=${config.app}&stream=${streamName}`;
    console.log('WHEP playback URL:', url);
    
    await player.play(url);
    console.log('WHEP playback started successfully for stream:', streamName);
    
    // Fallback: if ontrack doesn't fire, try setting srcObject directly
    setTimeout(() => {
      if (!videoElement.srcObject && player.stream) {
        console.log('Setting srcObject directly for stream:', streamName);
        videoElement.srcObject = player.stream;
      }
    }, 2000);
    
  } catch (err) {
    console.error("WHEP play failed for stream:", streamName, "Error:", err);
    console.error("This likely means the stream '" + streamName + "' is not currently available on the SRS server");
    
    // Show user-friendly error in video element
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff6b6b';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Return feed not available', canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillStyle = '#888';
      ctx.font = '12px Arial';
      ctx.fillText(`Stream: ${streamName}`, canvas.width / 2, canvas.height / 2 + 15);
    }
    
    const stream = canvas.captureStream(1);
    videoElement.srcObject = stream;
  }
}
