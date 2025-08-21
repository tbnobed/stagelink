export interface SRSServerConfig {
  host: string;
  whipPort: number;
  apiPort: number;
  useHttps: boolean;
}

export function getSRSConfig(): SRSServerConfig {
  return {
    host: process.env.SRS_HOST || 'cdn2.obedtv.live',
    whipPort: parseInt(process.env.SRS_WHIP_PORT || '1990'),
    apiPort: parseInt(process.env.SRS_API_PORT || '1985'),
    useHttps: process.env.SRS_USE_HTTPS === 'true' || process.env.SRS_USE_HTTPS === undefined,
  };
}

export function getSRSApiUrl(): string {
  const config = getSRSConfig();
  // SRS API typically runs on HTTP even if WHIP/WHEP uses HTTPS
  const protocol = 'http';
  return `${protocol}://${config.host}:${config.apiPort}/api/v1/summaries`;
}

export function getSRSWhipUrl(app: string, stream: string): string {
  const config = getSRSConfig();
  const protocol = config.useHttps ? 'https' : 'http';
  return `${protocol}://${config.host}:${config.whipPort}/rtc/v1/whip/?app=${app}&stream=${stream}`;
}

export function getSRSWhepUrl(app: string, stream: string): string {
  const config = getSRSConfig();
  const protocol = config.useHttps ? 'https' : 'http';
  return `${protocol}://${config.host}:${config.whipPort}/rtc/v1/whep/?app=${app}&stream=${stream}`;
}