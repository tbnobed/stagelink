import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Pencil, Trash2, Plus, Server, RefreshCw } from "lucide-react";

// ---------- types ----------
interface MonitoredServer {
  id: string;
  name: string;
  address: string;
  apiPort: number;
  useHttps: boolean;
}

interface SRSSummaryData {
  code: number;
  data: {
    self: { srs_uptime: number; cpu_percent: number };
    system: {
      cpu_percent: number;
      mem_ram_percent: number;
      conn_srs: number;
    };
  };
}

interface ServerStatsResponse {
  status: "online" | "error";
  error?: string;
  data?: SRSSummaryData;
}

// ---------- localStorage helpers ----------
const STORAGE_KEY = "va_monitored_servers";

function loadServers(): MonitoredServer[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveServers(servers: MonitoredServer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
}

// ---------- form schema ----------
const serverSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  apiPort: z.coerce.number().int().min(1).max(65535),
  useHttps: z.boolean().default(false),
});
type ServerFormValues = z.infer<typeof serverSchema>;

// ---------- helpers ----------
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.length ? parts.join(" ") : "<1m";
}

function cpuColor(pct: number) {
  if (pct >= 90) return "text-red-400";
  if (pct >= 70) return "text-yellow-400";
  return "text-green-400";
}

function memColor(pct: number) {
  if (pct >= 0.95) return "text-red-400";
  if (pct >= 0.8) return "text-yellow-400";
  return "text-green-400";
}

// ---------- ServerCard ----------
function ServerCard({
  server,
  onEdit,
  onDelete,
}: {
  server: MonitoredServer;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data, isFetching, refetch } = useQuery<ServerStatsResponse>({
    queryKey: ["/api/monitor/server-stats", server.id],
    queryFn: () =>
      apiRequest("POST", "/api/monitor/server-stats", {
        address: server.address,
        port: server.apiPort,
        useHttps: server.useHttps,
      }).then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const isOnline = data?.status === "online" && data.data?.code === 0;
  const stats = isOnline ? data!.data!.data : null;

  return (
    <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark hover:border-va-primary/50 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-va-primary/10 p-2.5 rounded-lg">
            <Server className="w-5 h-5 text-va-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold va-text-primary">{server.name}</h3>
            <p className="text-xs va-text-secondary font-mono mt-0.5">
              {server.address}:{server.apiPort}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* status indicator */}
          <div className="flex items-center gap-1.5 mr-1">
            <div
              className={`w-2 h-2 rounded-full ${
                isFetching
                  ? "bg-yellow-400 animate-pulse"
                  : isOnline
                  ? "bg-green-400 animate-pulse"
                  : "bg-red-400"
              }`}
            />
            <span
              className={`text-xs font-medium ${
                isFetching ? "text-yellow-400" : isOnline ? "text-green-400" : "text-red-400"
              }`}
            >
              {isFetching ? "Checking" : isOnline ? "Online" : "Offline"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-gray-400 hover:text-blue-400"
            onClick={() => refetch()}
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-gray-400 hover:text-va-primary"
            onClick={onEdit}
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-gray-400 hover:text-red-400"
            onClick={onDelete}
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${cpuColor(stats.system.cpu_percent)}`}>
              {stats.system.cpu_percent.toFixed(1)}%
            </div>
            <div className="va-text-secondary text-xs mt-0.5">CPU</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${memColor(stats.system.mem_ram_percent)}`}>
              {(stats.system.mem_ram_percent * 100).toFixed(1)}%
            </div>
            <div className="va-text-secondary text-xs mt-0.5">Memory</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.system.conn_srs}</div>
            <div className="va-text-secondary text-xs mt-0.5">Connections</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold va-text-primary">
              {formatUptime(stats.self.srs_uptime)}
            </div>
            <div className="va-text-secondary text-xs mt-0.5">Uptime</div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 va-text-secondary text-sm">
          {isFetching ? "Fetching stats…" : data?.error || "Server unavailable"}
        </div>
      )}
    </div>
  );
}

// ---------- ServerDialog ----------
function ServerDialog({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial?: MonitoredServer;
  onSave: (values: ServerFormValues) => void;
  onClose: () => void;
}) {
  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverSchema),
    defaultValues: {
      name: initial?.name ?? "",
      address: initial?.address ?? "",
      apiPort: initial?.apiPort ?? 1985,
      useHttps: initial?.useHttps ?? false,
    },
  });

  useEffect(() => {
    form.reset({
      name: initial?.name ?? "",
      address: initial?.address ?? "",
      apiPort: initial?.apiPort ?? 1985,
      useHttps: initial?.useHttps ?? false,
    });
  }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Server" : "Add Server"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. WHIP Primary" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server Address</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 192.168.1.10 or srs.example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apiPort"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Port</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="1985" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="useHttps"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <Label className="!mt-0">Use HTTPS</Label>
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">{initial ? "Save Changes" : "Add Server"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- StatCard ----------
function StatCard({
  label,
  value,
  icon,
  color,
  isLoading,
}: {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  isLoading?: boolean;
}) {
  return (
    <div className="va-bg-dark-surface rounded-2xl p-6 border va-border-dark hover:border-va-primary/50 transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <i className={`${icon} text-2xl`}></i>
        </div>
        <div>
          <div className="va-text-secondary text-sm mb-1">{label}</div>
          <div className="text-3xl font-bold va-text-primary">
            {isLoading ? (
              <span className="animate-pulse">—</span>
            ) : (
              value
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Dashboard ----------
export default function Dashboard() {
  const { toast } = useToast();
  const [servers, setServers] = useState<MonitoredServer[]>(loadServers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MonitoredServer | undefined>();

  const { data: productions, isLoading: loadingProductions } = useQuery<any[]>({
    queryKey: ["/api/productions"],
  });

  const { data: links, isLoading: loadingLinks } = useQuery<any[]>({
    queryKey: ["/api/links"],
  });

  const { data: rooms, isLoading: loadingRooms } = useQuery<any[]>({
    queryKey: ["/api/rooms"],
  });

  const activeProductions = (productions ?? []).filter((p: any) => p.status === "active").length;
  const totalLinks = (links ?? []).length;
  const totalRooms = (rooms ?? []).length;

  function persistServers(updated: MonitoredServer[]) {
    setServers(updated);
    saveServers(updated);
  }

  function handleSave(values: ServerFormValues) {
    if (editingServer) {
      persistServers(
        servers.map((s) =>
          s.id === editingServer.id ? { ...editingServer, ...values } : s
        )
      );
      toast({ title: "Server updated" });
    } else {
      const newServer: MonitoredServer = {
        id: Math.random().toString(36).slice(2),
        ...values,
      };
      persistServers([...servers, newServer]);
      toast({ title: "Server added" });
    }
    setDialogOpen(false);
    setEditingServer(undefined);
  }

  function handleDelete(id: string) {
    persistServers(servers.filter((s) => s.id !== id));
    // Evict cached query
    queryClient.removeQueries({ queryKey: ["/api/monitor/server-stats", id] });
    toast({ title: "Server removed" });
  }

  function openAdd() {
    setEditingServer(undefined);
    setDialogOpen(true);
  }

  function openEdit(server: MonitoredServer) {
    setEditingServer(server);
    setDialogOpen(true);
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold va-text-primary mb-1">Dashboard</h1>
          <p className="va-text-secondary">Platform overview and server health</p>
        </div>

        {/* Stat Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard
            label="Active Productions"
            value={activeProductions}
            icon="fas fa-broadcast-tower"
            color="bg-blue-500/20 text-blue-400"
            isLoading={loadingProductions}
          />
          <StatCard
            label="Guest Links"
            value={totalLinks}
            icon="fas fa-link"
            color="bg-va-primary/20 text-va-primary"
            isLoading={loadingLinks}
          />
          <StatCard
            label="Rooms"
            value={totalRooms}
            icon="fas fa-video"
            color="bg-purple-500/20 text-purple-400"
            isLoading={loadingRooms}
          />
        </div>

        {/* Server Monitors */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold va-text-primary">Server Monitors</h2>
            <p className="va-text-secondary text-sm mt-0.5">
              Add SRS servers to track CPU, memory, connections and uptime.
            </p>
          </div>
          <Button onClick={openAdd} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Server
          </Button>
        </div>

        {servers.length === 0 ? (
          <div className="va-bg-dark-surface rounded-2xl border va-border-dark border-dashed p-12 text-center">
            <Server className="w-10 h-10 va-text-secondary mx-auto mb-3 opacity-40" />
            <p className="va-text-secondary">No servers added yet.</p>
            <p className="va-text-secondary text-sm mt-1">
              Click <strong>Add Server</strong> to start monitoring a server.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                onEdit={() => openEdit(server)}
                onDelete={() => handleDelete(server.id)}
              />
            ))}
          </div>
        )}

        {/* Server dialog */}
        <ServerDialog
          open={dialogOpen}
          initial={editingServer}
          onSave={handleSave}
          onClose={() => {
            setDialogOpen(false);
            setEditingServer(undefined);
          }}
        />
      </div>
    </div>
  );
}
