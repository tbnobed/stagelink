// Global variables for SRS SDK
declare global {
  interface Window {
    SrsRtcWhipWhepAsync: any;
    SrsRtcFormatStats: any;
    parse_query_string: any;
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

  try {
    const player = new window.SrsRtcWhipWhepAsync();
    videoElement.srcObject = player.stream;

    const url = `https://cdn2.obedtv.live:1990/rtc/v1/whep/?app=${config.app}&stream=${streamName}`;
    await player.play(url);
  } catch (err) {
    console.error("WHEP play failed", err);
  }
}
