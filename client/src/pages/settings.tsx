import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Pencil, Trash2, Plus, Check, X, GripVertical } from "lucide-react";
import type { ReturnFeed } from "@shared/schema";

interface FeedRowProps {
  feed: ReturnFeed;
  onSave: (id: number, updates: Partial<ReturnFeed>) => void;
  onDelete: (id: number) => void;
}

function FeedRow({ feed, onSave, onDelete }: FeedRowProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(feed.label);
  const [streamName, setStreamName] = useState(feed.streamName);
  const [serverAddress, setServerAddress] = useState(feed.serverAddress || '');

  const handleSave = () => {
    if (!label.trim() || !streamName.trim()) return;
    onSave(feed.id, { label: label.trim(), streamName: streamName.trim(), serverAddress: serverAddress.trim() || null });
    setEditing(false);
  };

  const handleCancel = () => {
    setLabel(feed.label);
    setStreamName(feed.streamName);
    setServerAddress(feed.serverAddress || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="border-b border-gray-800">
        <td className="px-4 py-3">
          <Input value={label} onChange={e => setLabel(e.target.value)}
            className="h-8 bg-gray-900 border-gray-700 text-white text-sm" placeholder="Display name" />
        </td>
        <td className="px-4 py-3">
          <Input value={streamName} onChange={e => setStreamName(e.target.value)}
            className="h-8 bg-gray-900 border-gray-700 text-white text-sm font-mono" placeholder="stream_name" />
        </td>
        <td className="px-4 py-3">
          <Input value={serverAddress} onChange={e => setServerAddress(e.target.value)}
            className="h-8 bg-gray-900 border-gray-700 text-white text-sm font-mono" placeholder="host:port (optional)" />
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="h-7 px-2 bg-va-primary hover:bg-va-primary/90">
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel} className="h-7 px-2 text-gray-400 hover:text-white">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-900/50 group">
      <td className="px-4 py-3 text-white font-medium">{feed.label}</td>
      <td className="px-4 py-3 text-gray-300 font-mono text-sm">{feed.streamName}</td>
      <td className="px-4 py-3 text-gray-400 font-mono text-sm">{feed.serverAddress || <span className="text-gray-600 italic">default</span>}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}
            className="h-7 px-2 text-gray-400 hover:text-white">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(feed.id)}
            className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-900/20">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AddFeedRow({ onAdd }: { onAdd: (feed: { label: string; streamName: string; serverAddress: string | null; sortOrder: number }) => void }) {
  const [label, setLabel] = useState('');
  const [streamName, setStreamName] = useState('');
  const [serverAddress, setServerAddress] = useState('');
  const [open, setOpen] = useState(false);

  const handleAdd = () => {
    if (!label.trim() || !streamName.trim()) return;
    onAdd({ label: label.trim(), streamName: streamName.trim(), serverAddress: serverAddress.trim() || null, sortOrder: 999 });
    setLabel('');
    setStreamName('');
    setServerAddress('');
    setOpen(false);
  };

  if (!open) {
    return (
      <tr>
        <td colSpan={4} className="px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}
            className="text-va-primary hover:text-va-primary/80 hover:bg-va-primary/10 gap-2">
            <Plus className="h-4 w-4" />
            Add return feed
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-800 bg-gray-900/30">
      <td className="px-4 py-3">
        <Input value={label} onChange={e => setLabel(e.target.value)}
          className="h-8 bg-gray-900 border-gray-700 text-white text-sm" placeholder="e.g. Socal 7" autoFocus />
      </td>
      <td className="px-4 py-3">
        <Input value={streamName} onChange={e => setStreamName(e.target.value)}
          className="h-8 bg-gray-900 border-gray-700 text-white text-sm font-mono" placeholder="e.g. Socal7" />
      </td>
      <td className="px-4 py-3">
        <Input value={serverAddress} onChange={e => setServerAddress(e.target.value)}
          className="h-8 bg-gray-900 border-gray-700 text-white text-sm font-mono" placeholder="host:port (optional)" />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <Button size="sm" onClick={handleAdd} className="h-7 px-2 bg-va-primary hover:bg-va-primary/90">
            <Check className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-7 px-2 text-gray-400 hover:text-white">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: feeds = [], isLoading } = useQuery<ReturnFeed[]>({
    queryKey: ['/api/return-feeds'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { label: string; streamName: string; serverAddress: string | null; sortOrder: number }) => {
      const res = await apiRequest('POST', '/api/return-feeds', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/return-feeds'] });
      toast({ title: 'Return feed added' });
    },
    onError: () => toast({ title: 'Failed to add return feed', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<ReturnFeed> }) => {
      const res = await apiRequest('PUT', `/api/return-feeds/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/return-feeds'] });
      toast({ title: 'Return feed updated' });
    },
    onError: () => toast({ title: 'Failed to update return feed', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/return-feeds/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/return-feeds'] });
      toast({ title: 'Return feed deleted' });
    },
    onError: () => toast({ title: 'Failed to delete return feed', variant: 'destructive' }),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage platform configuration</p>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Return Feeds</h2>
          <p className="text-sm text-gray-400 mt-1">
            Configure the studio return feed streams available when creating guest links and productions.
            The <span className="font-mono text-gray-300">Stream Name</span> must match the stream key on the SRS server.
            Set a <span className="font-mono text-gray-300">Server Address</span> (host:port) to override the default SRS server for that feed.
          </p>
        </div>

        {isLoading ? (
          <div className="px-6 py-8 text-gray-500 text-center">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Display Name</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Stream Name</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Server Override</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {feeds.map(feed => (
                <FeedRow
                  key={feed.id}
                  feed={feed}
                  onSave={(id, updates) => updateMutation.mutate({ id, updates })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
              <AddFeedRow onAdd={(data) => createMutation.mutate(data)} />
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
