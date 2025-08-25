import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface SRSStats {
  code: number;
  server: string;
  service: string;
  pid: string;
  data: {
    ok: boolean;
    now_ms: number;
    self: {
      version: string;
      pid: number;
      ppid: number;
      mem_kbyte: number;
      mem_percent: number;
      cpu_percent: number;
      srs_uptime: number;
    };
    system: {
      cpu_percent: number;
      disk_read_KBps: number;
      disk_write_KBps: number;
      disk_busy_percent: number;
      mem_ram_kbyte: number;
      mem_ram_percent: number;
      mem_swap_kbyte: number;
      mem_swap_percent: number;
      cpus: number;
      cpus_online: number;
      uptime: number;
      load_1m: number;
      load_5m: number;
      load_15m: number;
      net_recv_bytes: number;
      net_send_bytes: number;
      net_recvi_bytes: number;
      net_sendi_bytes: number;
      srs_recv_bytes: number;
      srs_send_bytes: number;
      conn_sys: number;
      conn_sys_et: number;
      conn_sys_tw: number;
      conn_sys_udp: number;
      conn_srs: number;
    };
  };
}

interface SRSConfig {
  host: string;
  whipPort: number;
  apiPort: number;
  useHttps: boolean;
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
  whipBaseUrl: string;
  whepBaseUrl: string;
  apiBaseUrl: string;
}

interface ServiceHealth {
  name: string;
  status: 'online' | 'error' | 'offline';
  statusCode?: number;
  error?: string;
  url: string;
}

interface SRSHealth {
  timestamp: number;
  services: {
    whip: ServiceHealth;
    whep: ServiceHealth;
    api: ServiceHealth;
  };
}

const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

const getStatusColor = (value: number, thresholds: { warning: number; critical: number }): string => {
  if (value >= thresholds.critical) return "text-red-400";
  if (value >= thresholds.warning) return "text-yellow-400";
  return "text-green-400";
};

export default function SRSMonitoring() {
  const [showDetails, setShowDetails] = useState(false);

  const { data: stats, isLoading, error } = useQuery<SRSStats>({
    queryKey: ["/api/srs/stats"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: config, isLoading: configLoading } = useQuery<SRSConfig>({
    queryKey: ["/api/srs/config"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: health, isLoading: healthLoading } = useQuery<SRSHealth>({
    queryKey: ["/api/srs/health"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading || configLoading || healthLoading) {
    return (
      <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark">
        <div className="flex items-center mb-4">
          <div className="bg-blue-500/20 p-3 rounded-lg mr-4">
            <i className="fas fa-server text-blue-400 text-xl"></i>
          </div>
          <h3 className="text-xl font-semibold va-text-primary">SRS Server Status</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <i className="fas fa-spinner fa-spin text-blue-400 text-2xl mr-3"></i>
          <span className="va-text-secondary">Loading server information...</span>
        </div>
      </div>
    );
  }

  if (error || !stats || stats.code !== 0) {
    return (
      <div className="space-y-6">
        {/* Server Configuration Status */}
        {config && (
          <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark">
            <div className="flex items-center mb-4">
              <div className="bg-yellow-500/20 p-3 rounded-lg mr-4">
                <i className="fas fa-server text-yellow-400 text-xl"></i>
              </div>
              <h3 className="text-xl font-semibold va-text-primary">SRS Server Configuration</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {/* WHIP Server */}
              <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                <div className="flex items-center mb-2">
                  <i className="fas fa-upload text-purple-400 mr-2"></i>
                  <h4 className="font-semibold va-text-primary">WHIP Server</h4>
                </div>
                <div className="text-sm space-y-1">
                  <div className="va-text-secondary">
                    {config.whip.useHttps ? 'https' : 'http'}://{config.whip.host}:{config.whip.port}
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                    <span className="va-text-yellow text-xs">Publishing Service</span>
                  </div>
                </div>
              </div>
              {/* WHEP Server */}
              <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                <div className="flex items-center mb-2">
                  <i className="fas fa-download text-green-400 mr-2"></i>
                  <h4 className="font-semibold va-text-primary">WHEP Server</h4>
                </div>
                <div className="text-sm space-y-1">
                  <div className="va-text-secondary">
                    {config.whep.useHttps ? 'https' : 'http'}://{config.whep.host}:{config.whep.port}
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                    <span className="va-text-yellow text-xs">Viewing Service</span>
                  </div>
                </div>
              </div>
              {/* API Server */}
              <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                <div className="flex items-center mb-2">
                  <i className="fas fa-cog text-blue-400 mr-2"></i>
                  <h4 className="font-semibold va-text-primary">API Server</h4>
                </div>
                <div className="text-sm space-y-1">
                  <div className="va-text-secondary">
                    {config.api.useHttps ? 'https' : 'http'}://{config.api.host}:{config.api.port}
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
                    <span className="va-text-red text-xs">Stats Unavailable</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Error Status */}
        <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark">
          <div className="flex items-center mb-4">
            <div className="bg-red-500/20 p-3 rounded-lg mr-4">
              <i className="fas fa-server text-red-400 text-xl"></i>
            </div>
            <h3 className="text-xl font-semibold va-text-primary">Server Statistics</h3>
          </div>
          <div className="flex items-center justify-center py-8">
            <i className="fas fa-exclamation-triangle text-red-400 text-2xl mr-3"></i>
            <div>
              <div className="va-text-primary font-medium">Statistics Unavailable</div>
              <div className="va-text-secondary text-sm">Unable to fetch server performance data</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { data: serverData } = stats;

  return (
    <div className="space-y-6">
      {/* Server Configuration Status */}
      {config && (
        <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark hover:border-va-primary/50 transition-all duration-300">
          <div className="flex items-center mb-6">
            <div className="bg-blue-500/20 p-3 rounded-lg mr-4">
              <i className="fas fa-network-wired text-blue-400 text-xl"></i>
            </div>
            <h3 className="text-xl font-semibold va-text-primary">SRS Server Configuration</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {/* WHIP Server */}
            <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <i className="fas fa-upload text-purple-400 mr-2"></i>
                  <h4 className="font-semibold va-text-primary">WHIP Server</h4>
                </div>
                <div className="flex items-center">
                  {health?.services.whip.status === 'online' ? (
                    <>
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                      <span className="va-text-green text-xs">Online</span>
                    </>
                  ) : health?.services.whip.status === 'error' ? (
                    <>
                      <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                      <span className="va-text-yellow text-xs">Warning</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
                      <span className="va-text-red text-xs">Offline</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-sm space-y-1">
                <div className="va-text-secondary font-mono text-xs">
                  {config.whip.useHttps ? 'https' : 'http'}://{config.whip.host}:{config.whip.port}
                </div>
                <div className="va-text-secondary text-xs">Publishing Service</div>
                {health?.services.whip.error && (
                  <div className="va-text-red text-xs truncate" title={health.services.whip.error}>
                    {health.services.whip.error}
                  </div>
                )}
              </div>
            </div>
            {/* WHEP Server */}
            <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <i className="fas fa-download text-green-400 mr-2"></i>
                  <h4 className="font-semibold va-text-primary">WHEP Server</h4>
                </div>
                <div className="flex items-center">
                  {health?.services.whep.status === 'online' ? (
                    <>
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                      <span className="va-text-green text-xs">Online</span>
                    </>
                  ) : health?.services.whep.status === 'error' ? (
                    <>
                      <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                      <span className="va-text-yellow text-xs">Warning</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
                      <span className="va-text-red text-xs">Offline</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-sm space-y-1">
                <div className="va-text-secondary font-mono text-xs">
                  {config.whep.useHttps ? 'https' : 'http'}://{config.whep.host}:{config.whep.port}
                </div>
                <div className="va-text-secondary text-xs">Viewing Service</div>
                {health?.services.whep.error && (
                  <div className="va-text-red text-xs truncate" title={health.services.whep.error}>
                    {health.services.whep.error}
                  </div>
                )}
              </div>
            </div>
            {/* API Server */}
            <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <i className="fas fa-cog text-blue-400 mr-2"></i>
                  <h4 className="font-semibold va-text-primary">API Server</h4>
                </div>
                <div className="flex items-center">
                  {health?.services.api.status === 'online' ? (
                    <>
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                      <span className="va-text-green text-xs">Online</span>
                    </>
                  ) : health?.services.api.status === 'error' ? (
                    <>
                      <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                      <span className="va-text-yellow text-xs">Warning</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
                      <span className="va-text-red text-xs">Offline</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-sm space-y-1">
                <div className="va-text-secondary font-mono text-xs">
                  {config.api.useHttps ? 'https' : 'http'}://{config.api.host}:{config.api.port}
                </div>
                <div className="va-text-secondary text-xs">Statistics & Management</div>
                {health?.services.api.error && (
                  <div className="va-text-red text-xs truncate" title={health.services.api.error}>
                    {health.services.api.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Server Performance Statistics */}
      <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark hover:border-va-primary/50 transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="bg-green-500/20 p-3 rounded-lg mr-4">
              <i className="fas fa-server text-green-400 text-xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-semibold va-text-primary">Server Performance</h3>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                <span className="va-text-green text-sm font-medium">Unified Stats from {config?.api.host || 'SRS Cluster'}</span>
              </div>
              <div className="va-text-secondary text-xs mt-1">
                Performance metrics represent the entire SRS server cluster
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="va-text-secondary hover:va-text-primary transition-colors"
            data-testid="button-toggle-srs-details"
          >
            <i className={`fas fa-chevron-${showDetails ? 'up' : 'down'}`}></i>
          </button>
        </div>
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatusColor(serverData.system.cpu_percent, { warning: 70, critical: 90 })}`}>
              {serverData.system.cpu_percent.toFixed(1)}%
            </div>
            <div className="va-text-secondary text-sm">CPU Usage</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatusColor(serverData.system.mem_ram_percent * 100, { warning: 80, critical: 95 })}`}>
              {(serverData.system.mem_ram_percent * 100).toFixed(1)}%
            </div>
            <div className="va-text-secondary text-sm">Memory</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold va-text-green">
              {serverData.system.conn_srs}
            </div>
            <div className="va-text-secondary text-sm">Active Streams</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold va-text-primary">
              {formatUptime(serverData.self.srs_uptime)}
            </div>
            <div className="va-text-secondary text-sm">Uptime</div>
          </div>
        </div>
        {/* Detailed Stats */}
        {showDetails && (
          <div className="border-t va-border-dark pt-4 mt-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Server Information */}
              <div>
                <h4 className="va-text-primary font-semibold mb-3 flex items-center">
                  <i className="fas fa-info-circle mr-2 text-blue-400"></i>
                  Server Info
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="va-text-secondary">Version:</span>
                    <span className="va-text-primary font-mono">{serverData.self.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="va-text-secondary">Server ID:</span>
                    <span className="va-text-primary font-mono">{stats.server}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="va-text-secondary">Process ID:</span>
                    <span className="va-text-primary font-mono">{serverData.self.pid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="va-text-secondary">CPUs:</span>
                    <span className="va-text-primary">{serverData.system.cpus_online}/{serverData.system.cpus}</span>
                  </div>
                </div>
              </div>

              {/* System Resources */}
              <div>
                <h4 className="va-text-primary font-semibold mb-3 flex items-center">
                  <i className="fas fa-chart-line mr-2 text-green-400"></i>
                  System Resources
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="va-text-secondary">Load Average (1m):</span>
                    <span className="va-text-primary">{serverData.system.load_1m}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="va-text-secondary">Load Average (5m):</span>
                    <span className="va-text-primary">{serverData.system.load_5m}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="va-text-secondary">RAM Usage:</span>
                    <span className="va-text-primary">{formatBytes(serverData.system.mem_ram_kbyte * 1024)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="va-text-secondary">System Uptime:</span>
                    <span className="va-text-primary">{formatUptime(serverData.system.uptime)}</span>
                  </div>
                </div>
              </div>

              {/* Network Statistics */}
              <div>
                <h4 className="va-text-primary font-semibold mb-3 flex items-center">
                  <i className="fas fa-network-wired mr-2 text-purple-400"></i>
                  Network Stats
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="va-text-secondary">Total Received:</span>
                    <span className="va-text-primary">{formatBytes(serverData.system.net_recvi_bytes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="va-text-secondary">Total Sent:</span>
                    <span className="va-text-primary">{formatBytes(serverData.system.net_sendi_bytes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="va-text-secondary">SRS Received:</span>
                    <span className="va-text-primary">{formatBytes(serverData.system.srs_recv_bytes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="va-text-secondary">SRS Sent:</span>
                    <span className="va-text-primary">{formatBytes(serverData.system.srs_send_bytes)}</span>
                  </div>
                </div>
              </div>

              {/* Connection Info */}
              <div>
                <h4 className="va-text-primary font-semibold mb-3 flex items-center">
                  <i className="fas fa-plug mr-2 text-yellow-400"></i>
                  Connections
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="va-text-secondary">System Connections:</span>
                    <span className="va-text-primary">{serverData.system.conn_sys}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="va-text-secondary">SRS Connections:</span>
                    <span className="va-text-primary font-semibold">{serverData.system.conn_srs}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="va-text-secondary">System ET:</span>
                    <span className="va-text-primary">{serverData.system.conn_sys_et}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="va-text-secondary">UDP Connections:</span>
                    <span className="va-text-primary">{serverData.system.conn_sys_udp}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Last updated */}
            <div className="text-center pt-4 border-t va-border-dark">
              <span className="va-text-secondary text-xs">
                <i className="fas fa-clock mr-1"></i>
                Last updated: {new Date(serverData.now_ms).toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}