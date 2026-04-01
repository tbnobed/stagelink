interface SRSServerConfig {
  host: string;
  whipPort: number;
  apiPort: number;
  useHttps: boolean;
  whipBaseUrl: string;
  whepBaseUrl: string;
  studioWhepBaseUrl: string;
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
    
    const data = await response.json();
    if (!data.studioWhepBaseUrl) {
      data.studioWhepBaseUrl = data.whepBaseUrl;
    }
    cachedConfig = data;
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
      whepBaseUrl: 'https://cdn2.obedtv.live:1990/rtc/v1/whep/',
      studioWhepBaseUrl: 'https://cdn2.obedtv.live:1990/rtc/v1/whep/'
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

export function buildStudioWhepUrl(app: string, stream: string): Promise<string> {
  return getSRSConfig().then(config => 
    `${config.studioWhepBaseUrl}?app=${app}&stream=${stream}`
  );
}

// Parse a server address that may be "host:port", "http://host:port", or
// "https://host:port". Returns { host, port, protocol }.
function parseServerAddressStr(serverAddress: string, fallbackPort: number, fallbackUseHttps: boolean) {
  let raw = serverAddress.trim();
  let protocol: string | null = null;
  if (raw.startsWith('https://')) {
    protocol = 'https';
    raw = raw.slice(8);
  } else if (raw.startsWith('http://')) {
    protocol = 'http';
    raw = raw.slice(7);
  }
  // Remove any trailing path component (e.g. accidental /rtc/...)
  const slashIdx = raw.indexOf('/');
  if (slashIdx !== -1) raw = raw.slice(0, slashIdx);
  const colonIdx = raw.lastIndexOf(':');
  const host = colonIdx !== -1 ? raw.slice(0, colonIdx) : raw;
  const portStr = colonIdx !== -1 ? raw.slice(colonIdx + 1) : '';
  const port = portStr ? parseInt(portStr, 10) : fallbackPort;
  const useHttps = protocol !== null ? protocol === 'https' : fallbackUseHttps;
  return { host, port, useHttps };
}

export async function buildWhipUrlForServer(serverAddress: string, app: string, stream: string): Promise<string> {
  const config = await getSRSConfig();
  const { host, port, useHttps } = parseServerAddressStr(serverAddress, config.whipPort, config.useHttps);
  const protocol = useHttps ? 'https' : 'http';
  return `${protocol}://${host}:${port}/rtc/v1/whip/?app=${app}&stream=${stream}`;
}

export async function buildWhepUrlForServer(serverAddress: string, app: string, stream: string): Promise<string> {
  const trimmed = serverAddress.trim();

  // If the stored value is a complete URL with a path (e.g. the full player URL
  // that a non-standard server requires), use it exactly as entered.
  // A full URL is detected by an http(s):// prefix AND a non-trivial path.
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname && parsed.pathname !== '/') {
        return trimmed;
      }
    } catch {
      // fall through to the standard builder below
    }
  }

  const config = await getSRSConfig();
  const { host, port, useHttps } = parseServerAddressStr(trimmed, config.whipPort, config.useHttps);
  const protocol = useHttps ? 'https' : 'http';
  return `${protocol}://${host}:${port}/rtc/v1/whep/?app=${app}&stream=${stream}`;
}

export function clearSRSConfigCache(): void {
  cachedConfig = null;
}