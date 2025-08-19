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

export async function startPlayback(videoElement: HTMLVideoElement, streamName: string, maxRetries: number = 5) {
  if (!window.SrsRtcWhipWhepAsync) {
    console.warn('SRS SDK not loaded, cannot start playback');
    return;
  }

  let retryCount = 0;
  const retryDelay = 2000; // 2 seconds between retries

  const attemptPlayback = async (): Promise<any> => {
    try {
      console.log(`Attempting WHEP playback for stream: ${streamName} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      const player = new window.SrsRtcWhipWhepAsync();
      
      // Set up connection event listeners
      player.pc.addEventListener('connectionstatechange', () => {
        console.log(`WHEP connection state: ${player.pc.connectionState}`);
        if (player.pc.connectionState === 'connected') {
          console.log(`WHEP playback connected successfully for stream: ${streamName}`);
        } else if (player.pc.connectionState === 'failed') {
          console.log(`WHEP connection failed for stream: ${streamName}`);
        }
      });

      player.pc.addEventListener('iceconnectionstatechange', () => {
        console.log(`WHEP ICE connection state: ${player.pc.iceConnectionState}`);
      });

      const url = `https://cdn2.obedtv.live:1990/rtc/v1/whep/?app=${config.app}&stream=${streamName}`;
      console.log(`WHEP URL: ${url}`);
      
      await player.play(url);
      videoElement.srcObject = player.stream;
      
      // Wait for connection to be established with resilience for brief disconnections
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 15000); // 15 second timeout

        let connectedCount = 0;
        const requiredStableConnections = 3; // Require 3 consecutive "connected" checks

        const checkConnection = () => {
          if (player.pc.connectionState === 'connected') {
            connectedCount++;
            console.log(`WHEP connection stable check ${connectedCount}/${requiredStableConnections} for stream: ${streamName}`);
            
            if (connectedCount >= requiredStableConnections) {
              clearTimeout(timeout);
              console.log(`WHEP playback connection confirmed stable for stream: ${streamName}`);
              resolve(player);
              return;
            }
          } else {
            connectedCount = 0; // Reset count if not connected
            if (player.pc.connectionState === 'failed') {
              clearTimeout(timeout);
              reject(new Error('Connection failed'));
              return;
            }
          }
          
          setTimeout(checkConnection, 200); // Check every 200ms
        };
        
        checkConnection();
      });
      
      console.log(`WHEP playback initiated successfully for stream: ${streamName}`);
      return player;
    } catch (err) {
      console.error(`WHEP play attempt ${retryCount + 1} failed:`, err);
      
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`Retrying WHEP playback in ${retryDelay}ms... (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return attemptPlayback();
      } else {
        console.error(`WHEP playback failed after ${maxRetries + 1} attempts for stream: ${streamName}`);
        throw err;
      }
    }
  };

  return attemptPlayback();
}
