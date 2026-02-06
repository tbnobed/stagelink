interface SRSServerEndpoint {
  host: string;
  port: number;
  useHttps: boolean;
  api: {
    host: string;
    port: number;
    useHttps: boolean;
  };
}

export interface SRSServerConfig {
  // Legacy properties for backward compatibility
  host: string;
  whipPort: number;
  apiPort: number;
  useHttps: boolean;
  
  whip: SRSServerEndpoint;
  whep: SRSServerEndpoint;
  studio: SRSServerEndpoint;
  api: {
    host: string;
    port: number;
    useHttps: boolean;
  };
}

export function getSRSConfig(): SRSServerConfig {
  // Default values from .env.example
  const legacyHost = process.env.SRS_HOST || 'cdn2.obedtv.live';
  const legacyUseHttps = process.env.SRS_USE_HTTPS === 'true' || process.env.SRS_USE_HTTPS === undefined;
  
  return {
    // Legacy properties for backward compatibility
    host: legacyHost,
    whipPort: parseInt(process.env.SRS_WHIP_PORT || '1990'),
    apiPort: parseInt(process.env.SRS_API_PORT || '1985'),
    useHttps: legacyUseHttps,
    
    // New separate server configurations with .env.example defaults
    whip: {
      host: process.env.SRS_WHIP_HOST || 'cdn2.obedtv.live',
      port: parseInt(process.env.SRS_WHIP_PORT || '1990'),
      useHttps: process.env.SRS_WHIP_USE_HTTPS === 'true' || 
                (process.env.SRS_WHIP_USE_HTTPS === undefined),
      api: {
        host: process.env.SRS_WHIP_HOST || 'cdn2.obedtv.live',
        port: parseInt(process.env.SRS_WHIP_API_PORT || '1985'),
        useHttps: process.env.SRS_WHIP_API_USE_HTTPS === 'true' || false,
      }
    },
    whep: {
      host: process.env.SRS_WHEP_HOST || 'cdn2.obedtv.live',
      port: parseInt(process.env.SRS_WHEP_PORT || '1990'),
      useHttps: process.env.SRS_WHEP_USE_HTTPS === 'true' || 
                (process.env.SRS_WHEP_USE_HTTPS === undefined),
      api: {
        host: process.env.SRS_WHEP_HOST || 'cdn2.obedtv.live',
        port: parseInt(process.env.SRS_WHEP_API_PORT || '1985'),
        useHttps: process.env.SRS_WHEP_API_USE_HTTPS === 'true' || false,
      }
    },
    studio: {
      host: process.env.SRS_STUDIO_HOST || process.env.SRS_WHEP_HOST || 'cdn2.obedtv.live',
      port: parseInt(process.env.SRS_STUDIO_PORT || process.env.SRS_WHEP_PORT || '1990'),
      useHttps: process.env.SRS_STUDIO_USE_HTTPS !== undefined
        ? process.env.SRS_STUDIO_USE_HTTPS === 'true'
        : (process.env.SRS_WHEP_USE_HTTPS === 'true' || process.env.SRS_WHEP_USE_HTTPS === undefined),
      api: {
        host: process.env.SRS_STUDIO_HOST || process.env.SRS_WHEP_HOST || 'cdn2.obedtv.live',
        port: parseInt(process.env.SRS_STUDIO_API_PORT || process.env.SRS_WHEP_API_PORT || '1985'),
        useHttps: process.env.SRS_STUDIO_API_USE_HTTPS === 'true' || false,
      }
    },
    api: {
      host: process.env.SRS_API_HOST || 'cdn2.obedtv.live',
      port: parseInt(process.env.SRS_API_PORT || '1985'),
      useHttps: process.env.SRS_API_USE_HTTPS === 'true' || false,
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

export function getSRSStudioWhepUrl(app: string, stream: string): string {
  const config = getSRSConfig();
  const protocol = config.studio.useHttps ? 'https' : 'http';
  return `${protocol}://${config.studio.host}:${config.studio.port}/rtc/v1/whep/?app=${app}&stream=${stream}`;
}