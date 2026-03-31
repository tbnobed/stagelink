import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Clock, Globe, Monitor, ArrowLeft } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";

export default function ConsentAuditPage() {
  const { user } = useAuth();
  const { isMobile } = useMobile();

  const { data: consentRecords, isLoading } = useQuery<any[]>({
    queryKey: ["/api/consent/records"],
  });

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Admin
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-[hsl(159,100%,41%)]" />
            <div>
              <h1 className="text-2xl font-bold">Consent Audit Log</h1>
              <p className="text-sm text-muted-foreground">
                Verifiable consent records for US broadcast compliance (CCPA, BIPA, FCC)
              </p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        {consentRecords && consentRecords.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{consentRecords.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Records</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-500">
                  {consentRecords.filter((r) => r.granted).length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Granted</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-500">
                  {consentRecords.filter((r) => !r.granted).length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Revoked</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {new Set(consentRecords.map((r) => r.streamName).filter(Boolean)).size}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Streams</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[hsl(159,100%,41%)]" />
              <div>
                <CardTitle>Consent Records</CardTitle>
                <CardDescription>
                  Full audit trail of all consent events recorded during streaming sessions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !consentRecords || consentRecords.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No consent records yet</p>
                <p className="text-sm mt-1">
                  Records appear here when guests accept the streaming consent dialog
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date / Time</TableHead>
                      <TableHead>User / Guest</TableHead>
                      <TableHead>Consent Type</TableHead>
                      <TableHead>Stream</TableHead>
                      <TableHead>IP Address</TableHead>
                      {!isMobile && <TableHead>Device</TableHead>}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consentRecords.map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                            {new Date(record.grantedAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.guestIdentifier ||
                            (record.userId ? `User #${record.userId}` : "Unknown")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {record.consentType.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {record.streamName || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                            {record.ipAddress}
                          </div>
                        </TableCell>
                        {!isMobile && (
                          <TableCell className="text-xs">
                            <div
                              className="flex items-center gap-1 max-w-[200px] truncate"
                              title={record.userAgent}
                            >
                              <Monitor className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{record.userAgent}</span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge
                            className={
                              record.granted
                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                : "bg-red-500/10 text-red-500 border-red-500/20"
                            }
                          >
                            {record.granted ? "Granted" : "Revoked"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
