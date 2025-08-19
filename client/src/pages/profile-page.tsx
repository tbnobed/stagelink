import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Key, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/change-password", data);
      return await res.json();
    },
    onSuccess: () => {
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to change password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation don't match.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  const handleInputChange = (field: keyof PasswordChangeData, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!user) {
    return <div>Please log in to view your profile.</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <User className="h-6 w-6" />
          <h1 className="text-3xl font-bold">User Profile</h1>
        </div>

        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>Your account details and role</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Username</Label>
                <div className="mt-1 p-2 bg-muted rounded-md" data-testid="text-username">
                  {user.username}
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <div className="mt-1 p-2 bg-muted rounded-md" data-testid="text-email">
                  {user.email || "Not provided"}
                </div>
              </div>
              <div>
                <Label>Role</Label>
                <div className="mt-1">
                  <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                    {user.role}
                  </Badge>
                </div>
              </div>
              <div>
                <Label>Member Since</Label>
                <div className="mt-1 p-2 bg-muted rounded-md">
                  {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => handleInputChange("currentPassword", e.target.value)}
                  placeholder="Enter your current password"
                  required
                  data-testid="input-current-password"
                />
              </div>

              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => handleInputChange("newPassword", e.target.value)}
                  placeholder="Enter your new password"
                  required
                  data-testid="input-new-password"
                />
              </div>

              <div>
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  placeholder="Confirm your new password"
                  required
                  data-testid="input-confirm-password"
                />
              </div>

              <Button
                type="submit"
                disabled={changePasswordMutation.isPending}
                data-testid="button-change-password"
              >
                <Save className="mr-2 h-4 w-4" />
                {changePasswordMutation.isPending ? "Updating..." : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}