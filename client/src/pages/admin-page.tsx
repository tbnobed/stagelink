import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Users, Settings, Mail, Shield, Globe, Pencil, Check, X, SlidersHorizontal, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMobile } from "@/hooks/use-mobile";
import { InviteDialog } from "@/components/invite-dialog";
import type { ReturnFeed, WhepServer } from "@shared/schema";

interface SafeUser {
  id: number;
  username: string;
  email: string | null;
  role: "admin" | "engineer" | "user";
  createdAt: string;
  updatedAt: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isMobile } = useMobile();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    email: "",
    role: "user" as "admin" | "engineer" | "user",
  });
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteUser, setInviteUser] = useState({
    email: "",
    role: "user" as "admin" | "engineer" | "user",
  });
  const [inviteDialog, setInviteDialog] = useState<{
    open: boolean;
    type: 'streaming' | 'viewer' | 'short-link';
    linkId?: string;
    shortCode?: string;
    linkDetails: any;
  }>({
    open: false,
    type: 'streaming',
    linkDetails: {}
  });

  const { data: users, isLoading: usersLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: consentCount } = useQuery<any[]>({
    queryKey: ["/api/consent/records"],
    select: (data) => data,
  });

  const { data: returnFeeds = [], isLoading: returnFeedsLoading } = useQuery<ReturnFeed[]>({
    queryKey: ["/api/return-feeds"],
  });

  const [editingFeedId, setEditingFeedId] = useState<number | null>(null);
  const [editFeedValues, setEditFeedValues] = useState({ label: '', streamName: '', serverAddress: '' });
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [newFeed, setNewFeed] = useState({ label: '', streamName: '', serverAddress: '' });

  const createFeedMutation = useMutation({
    mutationFn: async (data: { label: string; streamName: string; serverAddress: string | null; sortOrder: number }) => {
      const res = await apiRequest('POST', '/api/return-feeds', data);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/return-feeds'] }); setShowAddFeed(false); setNewFeed({ label: '', streamName: '', serverAddress: '' }); toast({ title: 'Feed added' }); },
    onError: () => toast({ title: 'Failed to add feed', variant: 'destructive' }),
  });

  const updateFeedMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<ReturnFeed> }) => {
      const res = await apiRequest('PUT', `/api/return-feeds/${id}`, updates);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/return-feeds'] }); setEditingFeedId(null); toast({ title: 'Feed updated' }); },
    onError: () => toast({ title: 'Failed to update feed', variant: 'destructive' }),
  });

  const deleteFeedMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/return-feeds/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/return-feeds'] }); toast({ title: 'Feed deleted' }); },
    onError: () => toast({ title: 'Failed to delete feed', variant: 'destructive' }),
  });

  const startEditFeed = (feed: ReturnFeed) => {
    setEditingFeedId(feed.id);
    setEditFeedValues({ label: feed.label, streamName: feed.streamName, serverAddress: feed.serverAddress || '' });
  };

  const { data: whepServers = [], isLoading: whepServersLoading } = useQuery<WhepServer[]>({
    queryKey: ["/api/whep-servers"],
  });

  const [editingWhepId, setEditingWhepId] = useState<number | null>(null);
  const [editWhepValues, setEditWhepValues] = useState({ label: '', address: '', isActive: true });
  const [showAddWhep, setShowAddWhep] = useState(false);
  const [newWhep, setNewWhep] = useState({ label: '', address: '' });

  const createWhepMutation = useMutation({
    mutationFn: async (data: { label: string; address: string; isActive: boolean; sortOrder: number }) => {
      const res = await apiRequest('POST', '/api/whep-servers', data);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/whep-servers'] }); setShowAddWhep(false); setNewWhep({ label: '', address: '' }); toast({ title: 'WHEP server added' }); },
    onError: () => toast({ title: 'Failed to add server', variant: 'destructive' }),
  });

  const updateWhepMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<WhepServer> }) => {
      const res = await apiRequest('PUT', `/api/whep-servers/${id}`, updates);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/whep-servers'] }); setEditingWhepId(null); toast({ title: 'WHEP server updated' }); },
    onError: () => toast({ title: 'Failed to update server', variant: 'destructive' }),
  });

  const deleteWhepMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/whep-servers/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/whep-servers'] }); toast({ title: 'WHEP server removed' }); },
    onError: () => toast({ title: 'Failed to remove server', variant: 'destructive' }),
  });

  const startEditWhep = (s: WhepServer) => {
    setEditingWhepId(s.id);
    setEditWhepValues({ label: s.label, address: s.address, isActive: s.isActive });
  };

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const res = await apiRequest("POST", "/api/users", userData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setNewUser({ username: "", password: "", email: "", role: "user" as "admin" | "engineer" | "user" });
      setShowCreateForm(false);
      toast({
        title: "User created",
        description: "New user has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User deleted",
        description: "User has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (userData: typeof inviteUser) => {
      const res = await apiRequest("POST", "/api/users/invite", userData);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setInviteUser({ email: "", role: "user" });
      setShowInviteForm(false);
      toast({
        title: "Invitation sent",
        description: data.emailSent 
          ? `Invitation email sent to ${data.email}` 
          : `User created but email failed to send. User: ${data.email}`,
        variant: data.emailSent ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to invite user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      toast({
        title: "Missing fields",
        description: "Username and password are required.",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate(newUser);
  };

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUser.email) {
      toast({
        title: "Missing email",
        description: "Email address is required for invitation.",
        variant: "destructive",
      });
      return;
    }
    inviteUserMutation.mutate(inviteUser);
  };

  const handleDeleteUser = (userId: number, username: string) => {
    if (userId === user?.id) {
      toast({
        title: "Cannot delete yourself",
        description: "You cannot delete your own account.",
        variant: "destructive",
      });
      return;
    }

    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? 'p-4 space-y-4' : 'container mx-auto p-6 space-y-6'}`}>
      <div className={`flex items-center gap-2 ${isMobile ? 'mb-4' : 'mb-6'}`}>
        <Settings className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`} />
        <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold`}>Admin Panel</h1>
      </div>

      {/* User Management Section */}
      <Card>
        <CardHeader>
          <div className={`${isMobile ? 'flex flex-col space-y-4' : 'flex items-center justify-between'}`}>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage platform users and their permissions</CardDescription>
              </div>
            </div>
            <div className={`flex gap-2 ${isMobile ? 'flex-col' : 'flex-row'}`}>
              <Button 
                onClick={() => setShowCreateForm(!showCreateForm)}
                className={`${isMobile ? 'btn-touch' : ''}`}
                data-testid="button-create-user"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
              <Button 
                onClick={() => setShowInviteForm(!showInviteForm)}
                variant="outline"
                className={`${isMobile ? 'btn-touch' : ''}`}
                data-testid="button-invite-user"
              >
                <Mail className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showCreateForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Create New User</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    <div className="space-y-2">
                      <Label htmlFor="new-username">Username *</Label>
                      <Input
                        id="new-username"
                        value={newUser.username}
                        onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="Enter username"
                        required
                        data-testid="input-new-username"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Password *</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter password"
                        required
                        data-testid="input-new-password"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="new-email">Email</Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter email (optional)"
                        data-testid="input-new-email"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="new-role">Role</Label>
                      <Select 
                        value={newUser.role} 
                        onValueChange={(value: "admin" | "engineer" | "user") => setNewUser(prev => ({ ...prev, role: value }))}
                      >
                        <SelectTrigger data-testid="select-new-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="engineer">Engineer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className={`${isMobile ? 'flex flex-col space-y-2' : 'flex gap-2'}`}>
                    <Button 
                      type="submit" 
                      disabled={createUserMutation.isPending}
                      className={`${isMobile ? 'btn-touch' : ''}`}
                      data-testid="button-submit-create-user"
                    >
                      {createUserMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create User
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowCreateForm(false)}
                      className={`${isMobile ? 'btn-touch' : ''}`}
                      data-testid="button-cancel-create-user"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {showInviteForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Invite New User</CardTitle>
                <CardDescription>Send an email invitation with temporary login credentials</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInviteUser} className="space-y-4">
                  <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    <div className="space-y-2">
                      <Label htmlFor="invite-email">Email Address *</Label>
                      <Input
                        id="invite-email"
                        type="email"
                        value={inviteUser.email}
                        onChange={(e) => setInviteUser(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter email address"
                        required
                        data-testid="input-invite-email"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="invite-role">Role</Label>
                      <Select 
                        value={inviteUser.role} 
                        onValueChange={(value: "admin" | "engineer" | "user") => setInviteUser(prev => ({ ...prev, role: value }))}
                      >
                        <SelectTrigger data-testid="select-invite-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="engineer">Engineer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className={`${isMobile ? 'flex flex-col space-y-2' : 'flex gap-2'}`}>
                    <Button 
                      type="submit" 
                      disabled={inviteUserMutation.isPending}
                      className={`${isMobile ? 'btn-touch' : ''}`}
                      data-testid="button-submit-invite-user"
                    >
                      {inviteUserMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Send Invitation
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowInviteForm(false)}
                      className={`${isMobile ? 'btn-touch' : ''}`}
                      data-testid="button-cancel-invite-user"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading users...</span>
            </div>
          ) : isMobile ? (
            // Mobile Card Layout
            <div className="space-y-3">
              {users?.map((userData) => (
                <Card key={userData.id} className="p-4" data-testid={`card-user-${userData.id}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold">{userData.username}</h3>
                      <Badge variant={
                        userData.role === 'admin' ? 'destructive' : 
                        userData.role === 'engineer' ? 'default' : 
                        'secondary'
                      }>
                        {userData.role}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteUser(userData.id, userData.username)}
                      disabled={userData.id === user?.id || deleteUserMutation.isPending}
                      className="btn-touch p-2"
                      data-testid={`button-delete-user-${userData.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1 text-sm va-text-secondary">
                    <div><span className="font-medium">Email:</span> {userData.email || "—"}</div>
                    <div><span className="font-medium">Created:</span> {new Date(userData.createdAt).toLocaleDateString()}</div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            // Desktop Table Layout
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((userData) => (
                  <TableRow key={userData.id} data-testid={`row-user-${userData.id}`}>
                    <TableCell className="font-medium">{userData.username}</TableCell>
                    <TableCell>{userData.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={
                        userData.role === 'admin' ? 'destructive' : 
                        userData.role === 'engineer' ? 'default' : 
                        'secondary'
                      }>
                        {userData.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(userData.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(userData.id, userData.username)}
                        disabled={userData.id === user?.id || deleteUserMutation.isPending}
                        data-testid={`button-delete-user-${userData.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Email Invite Testing Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <div>
              <CardTitle>Email Invites</CardTitle>
              <CardDescription>Test email invite functionality with SendGrid</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Email invites are now configured with SendGrid using alerts@obedtv.com as the sender.
              You can send invites for streaming sessions, viewer links, and short links from your Links page.
            </p>
            <div className="mt-3 space-y-2 text-xs">
              <div>✓ SendGrid API configured</div>
              <div>✓ Authenticated sender: alerts@obedtv.com</div>
              <div>✓ Professional StageLinq email templates</div>
              <div>✓ Support for custom messages</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consent Audit Log — link to dedicated page */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[hsl(159,100%,41%)]" />
              <div>
                <CardTitle>Consent Audit Log</CardTitle>
                <CardDescription>Verifiable consent records for US broadcast compliance (CCPA, BIPA, FCC)</CardDescription>
              </div>
            </div>
            <Link href="/admin/consent">
              <Button variant="outline" size="sm" className="gap-2 shrink-0">
                <ExternalLink className="h-4 w-4" />
                View Full Log
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-[hsl(159,100%,41%)] opacity-80" />
              <div>
                <div className="font-semibold text-lg">
                  {consentCount ? consentCount.length : 0}
                  <span className="text-sm font-normal text-muted-foreground ml-1">consent records on file</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {consentCount && consentCount.length > 0
                    ? `${consentCount.filter((r: any) => r.granted).length} granted · ${consentCount.filter((r: any) => !r.granted).length} revoked`
                    : 'Records appear when guests consent to streaming'}
                </div>
              </div>
            </div>
            <Link href="/admin/consent">
              <Button variant="default" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Open Log
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Return Feeds Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              <div>
                <CardTitle>Return Feeds</CardTitle>
                <CardDescription>Configure studio return feed streams available in the Generator and Productions pages</CardDescription>
              </div>
            </div>
            {!showAddFeed && (
              <Button size="sm" onClick={() => setShowAddFeed(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add Feed
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Display Name</TableHead>
                <TableHead>Stream Name</TableHead>
                <TableHead>Server Override</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returnFeedsLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</TableCell></TableRow>
              ) : returnFeeds.map(feed => (
                <TableRow key={feed.id}>
                  {editingFeedId === feed.id ? (
                    <>
                      <TableCell><Input value={editFeedValues.label} onChange={e => setEditFeedValues(v => ({ ...v, label: e.target.value }))} className="h-8 text-sm" /></TableCell>
                      <TableCell><Input value={editFeedValues.streamName} onChange={e => setEditFeedValues(v => ({ ...v, streamName: e.target.value }))} className="h-8 text-sm font-mono" /></TableCell>
                      <TableCell><Input value={editFeedValues.serverAddress} onChange={e => setEditFeedValues(v => ({ ...v, serverAddress: e.target.value }))} className="h-8 text-sm font-mono" placeholder="host:port (optional)" /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" className="h-7 px-2" onClick={() => updateFeedMutation.mutate({ id: feed.id, updates: { label: editFeedValues.label, streamName: editFeedValues.streamName, serverAddress: editFeedValues.serverAddress || null } })}><Check className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingFeedId(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">{feed.label}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{feed.streamName}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{feed.serverAddress || <span className="italic text-muted-foreground/50">default</span>}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startEditFeed(feed)}><Pencil className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteFeedMutation.mutate(feed.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              {showAddFeed && (
                <TableRow>
                  <TableCell><Input value={newFeed.label} onChange={e => setNewFeed(v => ({ ...v, label: e.target.value }))} className="h-8 text-sm" placeholder="e.g. Socal 7" autoFocus /></TableCell>
                  <TableCell><Input value={newFeed.streamName} onChange={e => setNewFeed(v => ({ ...v, streamName: e.target.value }))} className="h-8 text-sm font-mono" placeholder="e.g. Socal7" /></TableCell>
                  <TableCell><Input value={newFeed.serverAddress} onChange={e => setNewFeed(v => ({ ...v, serverAddress: e.target.value }))} className="h-8 text-sm font-mono" placeholder="host:port (optional)" /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" className="h-7 px-2" onClick={() => { if (newFeed.label && newFeed.streamName) createFeedMutation.mutate({ label: newFeed.label, streamName: newFeed.streamName, serverAddress: newFeed.serverAddress || null, sortOrder: 999 }); }}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setShowAddFeed(false); setNewFeed({ label: '', streamName: '', serverAddress: '' }); }}><X className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* WHEP Server Pool Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <div>
                <CardTitle>Return Feed WHEP Servers</CardTitle>
                <CardDescription>Dedicated servers for delivering the studio return feed to guests. Links are assigned round-robin across active servers. Per-feed server overrides (in Return Feeds above) take priority.</CardDescription>
              </div>
            </div>
            {!showAddWhep && (
              <Button size="sm" onClick={() => setShowAddWhep(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add Server
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Address (host:port)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {whepServersLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</TableCell></TableRow>
              ) : whepServers.length === 0 && !showAddWhep ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground italic text-sm">No dedicated WHEP servers configured — links will use the global default SRS server.</TableCell></TableRow>
              ) : whepServers.map(s => (
                <TableRow key={s.id}>
                  {editingWhepId === s.id ? (
                    <>
                      <TableCell><Input value={editWhepValues.label} onChange={e => setEditWhepValues(v => ({ ...v, label: e.target.value }))} className="h-8 text-sm" /></TableCell>
                      <TableCell><Input value={editWhepValues.address} onChange={e => setEditWhepValues(v => ({ ...v, address: e.target.value }))} className="h-8 text-sm font-mono" placeholder="host:port" /></TableCell>
                      <TableCell>
                        <Button size="sm" variant={editWhepValues.isActive ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setEditWhepValues(v => ({ ...v, isActive: !v.isActive }))}>
                          {editWhepValues.isActive ? 'Active' : 'Inactive'}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" className="h-7 px-2" onClick={() => updateWhepMutation.mutate({ id: s.id, updates: editWhepValues })}><Check className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingWhepId(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">{s.label}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{s.address}</TableCell>
                      <TableCell><Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => startEditWhep(s)}><Pencil className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteWhepMutation.mutate(s.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              {showAddWhep && (
                <TableRow>
                  <TableCell><Input value={newWhep.label} onChange={e => setNewWhep(v => ({ ...v, label: e.target.value }))} className="h-8 text-sm" placeholder="e.g. WHEP East" autoFocus /></TableCell>
                  <TableCell><Input value={newWhep.address} onChange={e => setNewWhep(v => ({ ...v, address: e.target.value }))} className="h-8 text-sm font-mono" placeholder="host:port" /></TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">Active</span></TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" className="h-7 px-2" onClick={() => { if (newWhep.label && newWhep.address) createWhepMutation.mutate({ label: newWhep.label, address: newWhep.address, isActive: true, sortOrder: 999 }); }}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setShowAddWhep(false); setNewWhep({ label: '', address: '' }); }}><X className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InviteDialog
        open={inviteDialog.open}
        onOpenChange={(open) => setInviteDialog(prev => ({ ...prev, open }))}
        inviteType={inviteDialog.type}
        linkId={inviteDialog.linkId}
        shortCode={inviteDialog.shortCode}
        linkDetails={inviteDialog.linkDetails}
      />
    </div>
  );
}