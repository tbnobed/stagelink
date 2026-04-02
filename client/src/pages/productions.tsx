import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Production, GeneratedLink, ReturnFeed } from "@shared/schema";

type ProductionStatus = 'draft' | 'active' | 'ended';
type InviteStatus = 'pending' | 'sent' | 'failed' | null;

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

  const { data: returnFeedOptions = [] } = useQuery<ReturnFeed[]>({
    queryKey: ['/api/return-feeds'],
    staleTime: 60000,
  });

  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnFeed) {
      toast({ title: 'Please select a return feed', variant: 'destructive' });
      return;
    }
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
        <Select value={returnFeed} onValueChange={setReturnFeed}>
          <SelectTrigger className="bg-gray-900 border-gray-700 text-white mt-1">
            <SelectValue placeholder="Select a return feed…" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            {returnFeedOptions.map(feed => (
              <SelectItem key={feed.id} value={feed.streamName}>{feed.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <input id="prod-scheduled" type="datetime-local" value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          style={{ colorScheme: 'dark' }}
          className="w-full h-10 rounded-md border border-gray-700 bg-gray-900 text-white mt-1 px-3 text-sm" />
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

  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);

  const sendSingleInvite = async (linkId: string) => {
    setSendingInviteId(linkId);
    try {
      const res = await fetch(`/api/productions/${productionId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ linkId }]),
      });
      const result = await res.json();
      if (result.sent > 0) {
        toast({ title: 'Invite sent' });
      } else {
        toast({ title: 'Failed to send invite', variant: 'destructive' });
      }
      refetch();
    } catch {
      toast({ title: 'Error sending invite', variant: 'destructive' });
    } finally {
      setSendingInviteId(null);
    }
  };

  const inviteStatusCell = (p: ParticipantRecord) => {
    const status = p.inviteStatus as InviteStatus;
    const ts = p.invitedAt ? new Date(p.invitedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
    if (!status || status === 'pending') {
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Not Sent</span>
          {p.guestEmail && (
            <Button size="sm" variant="outline"
              className="h-6 text-xs border-purple-600/40 text-purple-400 hover:bg-purple-500/10 px-2"
              onClick={() => sendSingleInvite(p.id)}
              disabled={sendingInviteId === p.id}
            >{sendingInviteId === p.id ? '...' : 'Send'}</Button>
          )}
        </div>
      );
    }
    if (status === 'sent') {
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-green-400" title={ts ? `Sent ${ts}` : undefined}>
            Invited{ts ? <span className="text-green-600 ml-1">{ts}</span> : null}
          </span>
          {p.guestEmail && (
            <Button size="sm" variant="outline"
              className="h-6 text-xs border-gray-600/40 text-gray-400 hover:bg-gray-500/10 px-2"
              onClick={() => sendSingleInvite(p.id)}
              disabled={sendingInviteId === p.id}
            >{sendingInviteId === p.id ? '...' : 'Resend'}</Button>
          )}
        </div>
      );
    }
    if (status === 'failed') {
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-red-400">Failed</span>
          {p.guestEmail && (
            <Button size="sm" variant="outline"
              className="h-6 text-xs border-red-600/40 text-red-400 hover:bg-red-500/10 px-2"
              onClick={() => sendSingleInvite(p.id)}
              disabled={sendingInviteId === p.id}
            >{sendingInviteId === p.id ? '...' : 'Retry'}</Button>
          )}
        </div>
      );
    }
    return null;
  };

  const ParticipantRow = ({ p, showPromote }: { p: ParticipantRecord; showPromote?: boolean }) => (
    <div className="bg-gray-800/50 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between">
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
      {p.guestEmail && (
        <div className="mt-1.5 pl-0">{inviteStatusCell(p)}</div>
      )}
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

function SendAllUnsentButton({ productionId }: { productionId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data } = useQuery<ParticipantsResponse>({
    queryKey: ['/api/productions', productionId, 'participants'],
    queryFn: async () => {
      const res = await fetch(`/api/productions/${productionId}/participants`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/productions/${productionId}/invite`, {});
      if (!res.ok) throw new Error('Failed to send invites');
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: `Invites sent: ${result.sent} sent, ${result.failed} failed` });
      queryClient.invalidateQueries({ queryKey: ['/api/productions', productionId, 'participants'] });
    },
    onError: () => toast({ title: 'Failed to send invites', variant: 'destructive' }),
  });

  const unsentCount = (data?.participants || []).filter(p =>
    p.guestEmail && (!p.inviteStatus || p.inviteStatus === 'pending' || p.inviteStatus === 'failed')
  ).length;

  if (unsentCount === 0) return null;

  return (
    <Button
      size="sm"
      onClick={() => sendMutation.mutate()}
      disabled={sendMutation.isPending}
      className="bg-purple-700 hover:bg-purple-600 text-white"
    >
      {sendMutation.isPending ? 'Sending...' : `Send All Unsent (${unsentCount})`}
    </Button>
  );
}

function InviteParticipantsPanel({ production }: { production: Production }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [singleName, setSingleName] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [csvText, setCsvText] = useState('');
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery<ParticipantsResponse>({
    queryKey: ['/api/productions', production.id, 'participants'],
    queryFn: async () => {
      const res = await fetch(`/api/productions/${production.id}/participants`);
      if (!res.ok) throw new Error('Failed to fetch participants');
      return res.json();
    },
    refetchInterval: 10000,
  });

  const addGuestsMutation = useMutation({
    mutationFn: async (guests: Array<{ guestName: string; guestEmail: string }>) => {
      const res = await apiRequest('POST', `/api/productions/${production.id}/participants`, { guests });
      if (!res.ok) throw new Error('Failed to add guests');
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: `${result.created?.length || 0} guest link(s) created` });
      queryClient.invalidateQueries({ queryKey: ['/api/productions', production.id, 'participants'] });
      setSingleName('');
      setSingleEmail('');
      setCsvText('');
    },
    onError: () => toast({ title: 'Failed to add guests', variant: 'destructive' }),
  });

  const sendInvitesMutation = useMutation({
    mutationFn: async (linkIds?: string[]) => {
      const res = await apiRequest('POST', `/api/productions/${production.id}/invite`, linkIds ? { linkIds } : {});
      if (!res.ok) throw new Error('Failed to send invites');
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: `Invites sent: ${result.sent} sent, ${result.failed} failed` });
      refetch();
    },
    onError: () => toast({ title: 'Failed to send invites', variant: 'destructive' }),
  });

  const handleAddSingle = () => {
    if (!singleEmail.trim()) {
      toast({ title: 'Email is required', variant: 'destructive' });
      return;
    }
    addGuestsMutation.mutate([{ guestName: singleName.trim(), guestEmail: singleEmail.trim() }]);
  };

  const handleAddCsv = () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    const guests = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        return { guestName: parts[0], guestEmail: parts[1] };
      } else if (parts.length === 1 && parts[0].includes('@')) {
        return { guestName: '', guestEmail: parts[0] };
      }
      return null;
    }).filter(Boolean) as Array<{ guestName: string; guestEmail: string }>;

    if (guests.length === 0) {
      toast({ title: 'No valid guests found in CSV', description: 'Use format: Name, email@example.com', variant: 'destructive' });
      return;
    }
    addGuestsMutation.mutate(guests);
  };

  const handleResend = async (linkId: string) => {
    setSendingIds(prev => new Set(prev).add(linkId));
    try {
      await sendInvitesMutation.mutateAsync([linkId]);
    } finally {
      setSendingIds(prev => { const s = new Set(prev); s.delete(linkId); return s; });
    }
  };

  const participants = data?.participants || [];
  const unsentCount = participants.filter(p => !p.inviteStatus || p.inviteStatus === 'pending' || p.inviteStatus === 'failed').length;
  const hasEmail = participants.filter(p => p.guestEmail).length;

  const inviteStatusBadge = (status: InviteStatus, invitedAt: Date | string | null | undefined) => {
    if (!status || status === 'pending') {
      return <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-500/10 text-gray-400 border-gray-600/30">Not Sent</span>;
    }
    if (status === 'sent') {
      const ts = invitedAt ? new Date(invitedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      return <span className="text-xs px-2 py-0.5 rounded-full border bg-green-500/10 text-green-400 border-green-500/20" title={ts ? `Invited ${ts}` : undefined}>Invited {ts && <span className="opacity-70">{ts}</span>}</span>;
    }
    if (status === 'failed') {
      return <span className="text-xs px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/20">Failed</span>;
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Add Single Guest */}
      <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
        <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Add a Guest</h4>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-gray-400 text-xs mb-1 block">Name</Label>
            <Input
              value={singleName}
              onChange={e => setSingleName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="bg-gray-900 border-gray-700 text-white"
            />
          </div>
          <div>
            <Label className="text-gray-400 text-xs mb-1 block">Email <span className="text-red-400">*</span></Label>
            <Input
              type="email"
              value={singleEmail}
              onChange={e => setSingleEmail(e.target.value)}
              placeholder="jane@example.com"
              className="bg-gray-900 border-gray-700 text-white"
              onKeyDown={e => e.key === 'Enter' && handleAddSingle()}
            />
          </div>
        </div>
        <Button
          onClick={handleAddSingle}
          disabled={addGuestsMutation.isPending || !singleEmail.trim()}
          className="bg-va-primary hover:bg-va-primary/90 text-white"
          size="sm"
        >
          {addGuestsMutation.isPending ? 'Adding...' : '+ Add Guest'}
        </Button>
      </div>

      {/* CSV Import */}
      <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
        <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">Bulk Import via CSV</h4>
        <p className="text-gray-500 text-xs mb-3">Paste one guest per line: <code className="bg-gray-700 px-1 rounded">Name, email@example.com</code></p>
        <Textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          placeholder={"John Smith, john@example.com\nMary Jones, mary@example.com"}
          className="bg-gray-900 border-gray-700 text-white font-mono text-sm h-28 mb-3"
        />
        <Button
          onClick={handleAddCsv}
          disabled={addGuestsMutation.isPending || !csvText.trim()}
          className="bg-va-primary hover:bg-va-primary/90 text-white"
          size="sm"
        >
          {addGuestsMutation.isPending ? 'Importing...' : 'Import Guests'}
        </Button>
      </div>

      {/* Participant List with Invite Status */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Invite Status ({participants.length} guests)
          </h4>
          {hasEmail > 0 && unsentCount > 0 && (
            <Button
              size="sm"
              onClick={() => sendInvitesMutation.mutate(undefined)}
              disabled={sendInvitesMutation.isPending}
              className="bg-purple-700 hover:bg-purple-600 text-white"
            >
              {sendInvitesMutation.isPending ? 'Sending...' : `Send All Unsent (${unsentCount})`}
            </Button>
          )}
          {hasEmail > 0 && unsentCount === 0 && participants.length > 0 && (
            <span className="text-xs text-green-400">All invites sent</span>
          )}
        </div>

        {isLoading && <p className="text-gray-500 text-sm">Loading...</p>}

        {!isLoading && participants.length === 0 && (
          <p className="text-gray-500 text-sm italic text-center py-6">No guests added yet. Use the form above to add participants.</p>
        )}

        {participants.length > 0 && (
          <div className="space-y-2">
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2.5 gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{p.guestName || '(unnamed)'}</p>
                  <p className="text-gray-400 text-xs truncate">{p.guestEmail || <span className="italic text-gray-600">no email</span>}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {inviteStatusBadge(p.inviteStatus as InviteStatus, p.invitedAt)}
                  {p.guestEmail && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-purple-600/40 text-purple-400 hover:bg-purple-500/10"
                      onClick={() => handleResend(p.id)}
                      disabled={sendingIds.has(p.id) || sendInvitesMutation.isPending}
                    >
                      {sendingIds.has(p.id) ? '...' : (p.inviteStatus === 'sent' ? 'Resend' : 'Send')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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

type DetailTab = 'participants' | 'invite';

export default function Productions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editProd, setEditProd] = useState<Production | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('participants');

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
                onClick={() => {
                  setSelectedId(prod.id === selectedId ? null : prod.id);
                  setDetailTab('participants');
                }}
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

                {/* Tabs */}
                <div className="border-b border-gray-700 px-6">
                  <div className="flex gap-0">
                    <button
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        detailTab === 'participants'
                          ? 'border-va-primary text-white'
                          : 'border-transparent text-gray-500 hover:text-gray-300'
                      }`}
                      onClick={() => setDetailTab('participants')}
                    >
                      Participants
                    </button>
                    <button
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        detailTab === 'invite'
                          ? 'border-purple-500 text-white'
                          : 'border-transparent text-gray-500 hover:text-gray-300'
                      }`}
                      onClick={() => setDetailTab('invite')}
                    >
                      Invite Participants
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {detailTab === 'participants' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold va-text-primary">Participants</h3>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-sm">Auto-refreshes every 5s</span>
                          <SendAllUnsentButton productionId={selected.id} />
                        </div>
                      </div>
                      <ParticipantsPanel productionId={selected.id} />
                    </div>
                  )}

                  {detailTab === 'invite' && (
                    <InviteParticipantsPanel production={selected} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
