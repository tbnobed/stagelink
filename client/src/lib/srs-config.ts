interface SRSServerConfig {
  host: string;
  whipPort: number;
  apiPort: number;
  useHttps: boolean;
  whipBaseUrl: string;
  whepBaseUrl: string;
}

let cachedConfig: SRSServerConfig | null = null;

export async function getSRSConfig(): Promise<SRSServerConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const response = await fetch('/api/srs/config');
    if (!response.ok) {
      throw new Error(`Failed to fetch SRS config: ${response.status}`);
    }
    
    cachedConfig = await response.json();
    return cachedConfig!;
  } catch (error) {
    console.warn('Failed to fetch SRS config, using defaults:', error);
    
    // Fallback to defaults
    const fallbackConfig: SRSServerConfig = {
      host: 'cdn2.obedtv.live',
      whipPort: 1990,
      apiPort: 1985,
      useHttps: true,
      whipBaseUrl: 'https://cdn2.obedtv.live:1990/rtc/v1/whip/',
      whepBaseUrl: 'https://cdn2.obedtv.live:1990/rtc/v1/whep/'
    };
    
    cachedConfig = fallbackConfig;
    return fallbackConfig;
  }
}

export function buildWhipUrl(app: string, stream: string): Promise<string> {
  return getSRSConfig().then(config => 
    `${config.whipBaseUrl}?app=${app}&stream=${stream}`
  );
}

export function buildWhepUrl(app: string, stream: string): Promise<string> {
  return getSRSConfig().then(config => 
    `${config.whepBaseUrl}?app=${app}&stream=${stream}`
  );
}

// Clear cache when needed (e.g., when server config changes)
export function clearSRSConfigCache(): void {
  cachedConfig = null;
}