import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Production, GeneratedLink } from "@shared/schema";

type ProductionStatus = 'draft' | 'active' | 'ended';

type ParticipantStatus = 'live' | 'waiting' | 'offline';
type LinkStatus = 'active' | 'expired';
interface ParticipantRecord extends GeneratedLink {
  status: ParticipantStatus;
  position?: number;
  linkStatus: LinkStatus;
}

interface ParticipantsResponse {
  production: Production;
  participants: ParticipantRecord[];
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  ended: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const participantStatusColors: Record<ParticipantStatus, string> = {
  live: 'bg-green-500/20 text-green-400 border-green-500/30',
  waiting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

interface ProductionFormData {
  name: string;
  description: string | null;
  returnFeed: string;
  maxLiveParticipants: number;
  status: ProductionStatus;
  assignedServer: string | null;
  scheduledAt: string | null;
}

function ProductionForm({ initial, onSave, onCancel }: {
  initial?: Partial<Production>;
  onSave: (data: ProductionFormData) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [returnFeed, setReturnFeed] = useState(initial?.returnFeed || '');
  const [maxLive, setMaxLive] = useState<number>(initial?.maxLiveParticipants ?? 128);
  const [status, setStatus] = useState<ProductionStatus>((initial?.status as ProductionStatus) || 'draft');
  const [assignedServer, setAssignedServer] = useState(initial?.assignedServer || '');
  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduledAt ? new Date(initial.scheduledAt).toISOString().slice(0, 16) : ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description: description || null,
      returnFeed,
      maxLiveParticipants: maxLive,
      status,
      assignedServer: assignedServer || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="prod-name" className="va-text-primary">Production Name</Label>
        <Input id="prod-name" value={name} onChange={e => setName(e.target.value)} required
          className="bg-gray-900 border-gray-700 text-white mt-1" placeholder="e.g. TBN Sunday Live" />
      </div>
      <div>
        <Label htmlFor="prod-desc" className="va-text-primary">Description</Label>
        <Textarea id="prod-desc" value={description} onChange={e => setDescription(e.target.value)}
          className="bg-gray-900 border-gray-700 text-white mt-1 h-20" placeholder="Optional description..." />
      </div>
      <div>
        <Label htmlFor="prod-return" className="va-text-primary">Return Feed Stream Name</Label>
        <Input id="prod-return" value={returnFeed} onChange={e => setReturnFeed(e.target.value)} required
          className="bg-gray-900 border-gray-700 text-white mt-1" placeholder="e.g. tbn-studio-feed" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="prod-max" className="va-text-primary">Max Live Participants</Label>
          <Input id="prod-max" type="number" min={1} max={1000} value={maxLive}
            onChange={e => setMaxLive(parseInt(e.target.value) || 128)}
            className="bg-gray-900 border-gray-700 text-white mt-1" />
        </div>
        <div>
          <Label htmlFor="prod-status" className="va-text-primary">Status</Label>
          <select id="prod-status" value={status} onChange={e => setStatus(e.target.value as ProductionStatus)}
            className="w-full mt-1 h-10 rounded-md border border-gray-700 bg-gray-900 text-white px-3">
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="prod-server" className="va-text-primary">Assigned Server (optional)</Label>
        <Input id="prod-server" value={assignedServer} onChange={e => setAssignedServer(e.target.value)}
          className="bg-gray-900 border-gray-700 text-white mt-1" placeholder="host:port" />
      </div>
      <div>
        <Label htmlFor="prod-scheduled" className="va-text-primary">Scheduled At (optional)</Label>
        <Input id="prod-scheduled" type="datetime-local" value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          className="bg-gray-900 border-gray-700 text-white mt-1" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit" className="bg-va-primary hover:bg-va-primary/90 text-white">
          {initial?.id ? 'Save Changes' : 'Create Production'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}
          className="border-gray-600 text-gray-300 hover:bg-gray-800">Cancel</Button>
      </div>
    </form>
  );
}

function ParticipantsPanel({ productionId }: { productionId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<ParticipantsResponse>({
    queryKey: ['/api/productions', productionId, 'participants'],
    queryFn: async () => {
      const res = await fetch(`/api/productions/${productionId}/participants`);
      if (!res.ok) throw new Error('Failed to fetch participants');
      return res.json();
    },
    refetchInterval: 5000,
  });

  const promoteMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const res = await apiRequest('POST', `/api/productions/${productionId}/participants/${linkId}/promote`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Participant promoted to live' });
      refetch();
    },
    onError: () => {
      toast({ title: 'Could not promote participant', description: 'They may no longer be in the waiting queue.', variant: 'destructive' });
    },
  });

  if (isLoading) return <div className="text-gray-400 py-8 text-center">Loading participants...</div>;
  if (!data) return null;

  const live = data.participants.filter(p => p.status === 'live');
  const waiting = data.participants.filter(p => p.status === 'waiting').sort((a, b) => (a.position || 0) - (b.position || 0));
  const offline = data.participants.filter(p => p.status === 'offline');

  const linkStatusColor = (ls: LinkStatus) =>
    ls === 'active' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-600/20';

  const ParticipantRow = ({ p, showPromote }: { p: ParticipantRecord; showPromote?: boolean }) => (
    <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-white text-sm font-medium truncate">{p.guestName || '(unnamed)'}</p>
        <p className="text-gray-400 text-xs truncate">{p.guestEmail || p.id}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {p.status === 'waiting' && p.position && (
          <span className="text-yellow-400 text-xs font-mono">#{p.position}</span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full border ${participantStatusColors[p.status]}`}>{p.status}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${linkStatusColor(p.linkStatus)}`}>{p.linkStatus}</span>
        {showPromote && (
          <Button size="sm" variant="outline"
            className="h-7 text-xs border-yellow-600/50 text-yellow-400 hover:bg-yellow-500/10"
            onClick={() => promoteMutation.mutate(p.id)}
            disabled={promoteMutation.isPending}
          >Promote</Button>
        )}
      </div>
    </div>
  );

  const Group = ({ title, items, showPromote }: { title: string; items: ParticipantRecord[]; showPromote?: boolean }) => (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">{title} ({items.length})</h4>
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm italic">None</p>
      ) : (
        <div className="space-y-2">
          {items.map(p => <ParticipantRow key={p.id} p={p} showPromote={showPromote} />)}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <Group title="Live" items={live} />
      <Group title="Waiting" items={waiting} showPromote />
      <Group title="Offline" items={offline} />
    </div>
  );
}

function ProductionSummaryBadges({ productionId }: { productionId: string }) {
  const { data } = useQuery<ParticipantsResponse>({
    queryKey: ['/api/productions', productionId, 'participants'],
    queryFn: async () => {
      const res = await fetch(`/api/productions/${productionId}/participants`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });
  if (!data) return null;
  const live = data.participants.filter(p => p.status === 'live').length;
  const waiting = data.participants.filter(p => p.status === 'waiting').length;
  const offline = data.participants.filter(p => p.status === 'offline').length;
  return (
    <div className="flex items-center gap-2 mt-1">
      {live > 0 && <span className="text-xs text-green-400">{live} live</span>}
      {waiting > 0 && <span className="text-xs text-yellow-400">{waiting} waiting</span>}
      {offline > 0 && <span className="text-xs text-gray-500">{offline} offline</span>}
      {live === 0 && waiting === 0 && offline === 0 && <span className="text-xs text-gray-600">No participants</span>}
    </div>
  );
}

export default function Productions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editProd, setEditProd] = useState<Production | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: productions, isLoading } = useQuery<Production[]>({
    queryKey: ['/api/productions'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProductionFormData) => {
      const res = await apiRequest('POST', '/api/productions', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/productions'] });
      toast({ title: 'Production created' });
      setShowForm(false);
    },
    onError: () => toast({ title: 'Failed to create production', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductionFormData }) => {
      const res = await apiRequest('PUT', `/api/productions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/productions'] });
      toast({ title: 'Production updated' });
      setEditProd(null);
    },
    onError: () => toast({ title: 'Failed to update production', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/productions/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/productions'] });
      toast({ title: 'Production deleted' });
      if (selectedId) setSelectedId(null);
    },
    onError: () => toast({ title: 'Failed to delete production', variant: 'destructive' }),
  });

  const selected = productions?.find(p => p.id === selectedId);

  return (
    <div className="min-h-screen va-bg-dark">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold va-text-primary">Productions</h1>
            <p className="va-text-secondary mt-1">Manage live events and participant capacity</p>
          </div>
          <Button onClick={() => { setShowForm(true); setEditProd(null); }}
            className="bg-va-primary hover:bg-va-primary/90 text-white">
            + New Production
          </Button>
        </div>

        {/* Create Form */}
        {showForm && !editProd && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-semibold va-text-primary mb-4">New Production</h2>
            <ProductionForm
              onSave={createMutation.mutate}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Productions List */}
          <div className="lg:col-span-1 space-y-3">
            {isLoading && <p className="text-gray-400">Loading...</p>}
            {productions?.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No productions yet</p>
                <p className="text-sm mt-1">Create your first production to get started</p>
              </div>
            )}
            {productions?.map(prod => (
              <div key={prod.id}
                className={`bg-gray-900 border rounded-xl p-4 cursor-pointer transition-all ${
                  selectedId === prod.id ? 'border-va-primary/70 bg-gray-800' : 'border-gray-700 hover:border-gray-600'
                }`}
                onClick={() => setSelectedId(prod.id === selectedId ? null : prod.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="va-text-primary font-semibold truncate">{prod.name}</h3>
                    {prod.description && (
                      <p className="text-gray-400 text-xs mt-0.5 truncate">{prod.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[prod.status]}`}>
                        {prod.status}
                      </span>
                      <span className="text-gray-500 text-xs">
                        cap: {prod.maxLiveParticipants}
                      </span>
                    </div>
                    <ProductionSummaryBadges productionId={prod.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-2">
            {!selected && (
              <div className="flex items-center justify-center h-64 text-gray-600">
                <p>Select a production to view details</p>
              </div>
            )}

            {selected && editProd?.id === selected.id && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
                <h2 className="text-xl font-semibold va-text-primary mb-4">Edit Production</h2>
                <ProductionForm
                  initial={editProd}
                  onSave={(data) => updateMutation.mutate({ id: editProd.id, data })}
                  onCancel={() => setEditProd(null)}
                />
              </div>
            )}

            {selected && editProd?.id !== selected.id && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl">
                {/* Production Header */}
                <div className="p-6 border-b border-gray-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold va-text-primary">{selected.name}</h2>
                      {selected.description && (
                        <p className="text-gray-400 mt-1">{selected.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <span className={`text-sm px-3 py-1 rounded-full border ${statusColors[selected.status]}`}>
                          {selected.status}
                        </span>
                        <span className="text-gray-400 text-sm">
                          Max live: <span className="text-white font-medium">{selected.maxLiveParticipants}</span>
                        </span>
                        <span className="text-gray-400 text-sm">
                          Return feed: <span className="text-va-primary font-mono text-xs">{selected.returnFeed}</span>
                        </span>
                        {selected.assignedServer && (
                          <span className="text-gray-400 text-sm">
                            Server: <span className="text-white font-mono text-xs">{selected.assignedServer}</span>
                          </span>
                        )}
                        {selected.scheduledAt && (
                          <span className="text-gray-400 text-sm">
                            Scheduled: <span className="text-white text-xs">{new Date(selected.scheduledAt).toLocaleString()}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm"
                        className="border-gray-600 text-gray-300 hover:bg-gray-800"
                        onClick={() => setEditProd(selected)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm"
                        className="border-red-600/50 text-red-400 hover:bg-red-500/10"
                        onClick={() => {
                          if (confirm(`Delete production "${selected.name}"? This cannot be undone.`)) {
                            deleteMutation.mutate(selected.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Participants */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold va-text-primary">Participants</h3>
                    <span className="text-gray-400 text-sm">Auto-refreshes every 5s</span>
                  </div>
                  <ParticipantsPanel productionId={selected.id} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
