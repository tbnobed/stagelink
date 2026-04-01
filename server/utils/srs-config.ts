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

// Returns the value if non-empty, otherwise undefined (treats '' same as unset).
function envStr(key: string): string | undefined {
  const v = process.env[key];
  return v !== undefined && v !== '' ? v : undefined;
}

export function getSRSConfig(): SRSServerConfig {
  // Legacy single-server fallback (SRS_HOST / SRS_USE_HTTPS).
  const legacyHost = envStr('SRS_HOST') || '';
  const legacyUseHttps = envStr('SRS_USE_HTTPS') !== undefined
    ? process.env.SRS_USE_HTTPS === 'true'
    : true; // default to HTTPS

  // When SRS_WHIP_HOST is not set but SRS_WHIP_SERVERS is, extract the first
  // server's host as the fallback so WHEP URLs are never blank.
  const firstPoolHost = (() => {
    if (!envStr('SRS_WHIP_HOST') && envStr('SRS_WHIP_SERVERS')) {
      const first = process.env.SRS_WHIP_SERVERS!.split(',')[0].trim();
      return first.split(':')[0] || '';
    }
    return '';
  })();

  // Resolve WHIP values first — WHEP falls back to these when not explicitly set.
  const whipHost = envStr('SRS_WHIP_HOST') || legacyHost || firstPoolHost;
  const whipPort = parseInt(envStr('SRS_WHIP_PORT') || '1990');
  const whipUseHttps = envStr('SRS_WHIP_USE_HTTPS') !== undefined
    ? process.env.SRS_WHIP_USE_HTTPS === 'true'
    : legacyUseHttps;
  const whipApiPort = parseInt(envStr('SRS_WHIP_API_PORT') || '1985');
  const whipApiUseHttps = process.env.SRS_WHIP_API_USE_HTTPS === 'true';

  // WHEP falls back to WHIP settings when not explicitly configured.
  const whepHost = envStr('SRS_WHEP_HOST') || whipHost;
  const whepPort = parseInt(envStr('SRS_WHEP_PORT') || String(whipPort));
  const whepUseHttps = envStr('SRS_WHEP_USE_HTTPS') !== undefined
    ? process.env.SRS_WHEP_USE_HTTPS === 'true'
    : whipUseHttps;
  const whepApiPort = parseInt(envStr('SRS_WHEP_API_PORT') || String(whipApiPort));
  const whepApiUseHttps = process.env.SRS_WHEP_API_USE_HTTPS === 'true';

  return {
    // Legacy properties for backward compatibility
    host: whipHost,
    whipPort,
    apiPort: parseInt(process.env.SRS_API_PORT || String(whipApiPort)),
    useHttps: whipUseHttps,

    whip: {
      host: whipHost,
      port: whipPort,
      useHttps: whipUseHttps,
      api: {
        host: whipHost,
        port: whipApiPort,
        useHttps: whipApiUseHttps,
      }
    },
    whep: {
      host: whepHost,
      port: whepPort,
      useHttps: whepUseHttps,
      api: {
        host: whepHost,
        port: whepApiPort,
        useHttps: whepApiUseHttps,
      }
    },
    studio: {
      host: envStr('SRS_STUDIO_HOST') || whepHost,
      port: parseInt(envStr('SRS_STUDIO_PORT') || String(whepPort)),
      useHttps: envStr('SRS_STUDIO_USE_HTTPS') !== undefined
        ? process.env.SRS_STUDIO_USE_HTTPS === 'true'
        : whepUseHttps,
      api: {
        host: process.env.SRS_STUDIO_HOST || whepHost,
        port: parseInt(process.env.SRS_STUDIO_API_PORT || String(whepApiPort)),
        useHttps: process.env.SRS_STUDIO_API_USE_HTTPS === 'true',
      }
    },
    api: {
      host: process.env.SRS_API_HOST || whipHost,
      port: parseInt(process.env.SRS_API_PORT || String(whipApiPort)),
      useHttps: process.env.SRS_API_USE_HTTPS === 'true',
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

export interface SRSServerEntry {
  host: string;
  port: number;
  useHttps: boolean;
}

let roundRobinIndex = 0;

export function getWhipServerList(): SRSServerEntry[] {
  const serversEnv = process.env.SRS_WHIP_SERVERS;
  if (!serversEnv || !serversEnv.trim()) {
    const config = getSRSConfig();
    return [{
      host: config.whip.host,
      port: config.whip.port,
      useHttps: config.whip.useHttps,
    }];
  }

  return serversEnv.split(',').map(entry => {
    const trimmed = entry.trim();
    const [host, portStr] = trimmed.split(':');
    return {
      host: host,
      port: parseInt(portStr || envStr('SRS_WHIP_PORT') || '1990'),
      useHttps: envStr('SRS_WHIP_USE_HTTPS') !== undefined
        ? process.env.SRS_WHIP_USE_HTTPS === 'true'
        : true, // default to HTTPS
    };
  });
}

export function getNextWhipServer(): SRSServerEntry {
  const servers = getWhipServerList();
  const server = servers[roundRobinIndex % servers.length];
  roundRobinIndex++;
  return server;
}

export function buildServerWhipUrl(server: SRSServerEntry, app: string, stream: string): string {
  const protocol = server.useHttps ? 'https' : 'http';
  return `${protocol}://${server.host}:${server.port}/rtc/v1/whip/?app=${app}&stream=${stream}`;
}

export function buildServerWhepUrl(server: SRSServerEntry, app: string, stream: string): string {
  const protocol = server.useHttps ? 'https' : 'http';
  return `${protocol}://${server.host}:${server.port}/rtc/v1/whep/?app=${app}&stream=${stream}`;
}

export function formatServerAddress(server: SRSServerEntry): string {
  return `${server.host}:${server.port}`;
}

export function parseServerAddress(address: string): SRSServerEntry | null {
  if (!address) return null;
  const [host, portStr] = address.split(':');
  if (!host) return null;
  return {
    host,
    port: parseInt(portStr || envStr('SRS_WHIP_PORT') || '1990'),
    useHttps: envStr('SRS_WHIP_USE_HTTPS') !== undefined
      ? process.env.SRS_WHIP_USE_HTTPS === 'true'
      : true, // default to HTTPS
  };
}