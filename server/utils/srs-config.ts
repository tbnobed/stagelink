export interface SRSServerConfig {
  // Legacy properties for backward compatibility
  host: string;
  whipPort: number;
  apiPort: number;
  useHttps: boolean;
  
  // New separate server configurations
  whip: {
    host: string;
    port: number;
    useHttps: boolean;
  };
  whep: {
    host: string;
    port: number;
    useHttps: boolean;
  };
  api: {
    host: string;
    port: number;
    useHttps: boolean;
  };
}

export function getSRSConfig(): SRSServerConfig {
  // Production server configurations from .env.example
  // WHIP Server: cdn2.obedtv.live:1990 (HTTPS)
  // WHEP Server: cdn1.obedtv.live:2022 (HTTP)  
  // API Server: cdn1.obedtv.live:1985 (HTTP)
  
  return {
    // Legacy properties for backward compatibility
    host: 'cdn2.obedtv.live',
    whipPort: 1990,
    apiPort: 1985,
    useHttps: true,
    
    // Production separate server configurations
    whip: {
      host: 'cdn2.obedtv.live',
      port: 1990,
      useHttps: true,
    },
    whep: {
      host: 'cdn1.obedtv.live',
      port: 2022,
      useHttps: false,
    },
    api: {
      host: 'cdn1.obedtv.live',
      port: 1985,
      useHttps: false,
    },
  };
}

export function getSRSApiUrl(): string {
  const config = getSRSConfig();
  const protocol = config.api.useHttps ? 'https' : 'http';
  return `${protocol}://${config.api.host}:${config.api.port}/api/v1/summaries`;
}

export function getSRSWhipUrl(app: string, stream: string): string {
  const config = getSRSConfig();
  const protocol = config.whip.useHttps ? 'https' : 'http';
  return `${protocol}://${config.whip.host}:${config.whip.port}/rtc/v1/whip/?app=${app}&stream=${stream}`;
}

export function getSRSWhepUrl(app: string, stream: string): string {
  const config = getSRSConfig();
  const protocol = config.whep.useHttps ? 'https' : 'http';
  return `${protocol}://${config.whep.host}:${config.whep.port}/rtc/v1/whep/?app=${app}&stream=${stream}`;
}