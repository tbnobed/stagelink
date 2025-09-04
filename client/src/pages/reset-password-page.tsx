import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMobile } from "@/hooks/use-mobile";
import stagelinqLogo from "@assets/stagelinq_logo.png";

export default function ResetPasswordPage() {
  const [location] = useLocation();
  const { toast } = useToast();
  const { isMobile } = useMobile();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    // Extract token from URL query parameters using window.location.search
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, [location]);

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ token, newPassword }: { token: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/password-reset/confirm", {
        token,
        newPassword,
      });
      return await res.json();
    },
    onSuccess: () => {
      setResetComplete(true);
      toast({
        title: "Password reset successful",
        description: "Your password has been updated. You can now log in with your new password.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Password reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      toast({
        title: "Invalid reset link",
        description: "The password reset link is invalid or missing.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both password fields match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({ token, newPassword });
  };

  if (resetComplete) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isMobile ? 'p-4' : 'p-6'} bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800`}>
        <Card className={`${isMobile ? 'w-full max-w-sm' : 'w-full max-w-md'} shadow-lg`}>
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <img 
                src={stagelinqLogo}
                alt="StageLinq"
                className="h-20 w-auto object-contain"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-green-600 flex items-center justify-center gap-2">
              <CheckCircle className="h-6 w-6" />
              Password Reset Complete
            </CardTitle>
            <CardDescription>
              Your password has been successfully updated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                You can now log in to StageLinq with your new password.
              </p>
              <Button 
                onClick={() => window.location.href = '/auth'}
                className="w-full"
                data-testid="button-go-to-login"
              >
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center ${isMobile ? 'p-4' : 'p-6'} bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800`}>
      <Card className={`${isMobile ? 'w-full max-w-sm' : 'w-full max-w-md'} shadow-lg`}>
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <img 
              src={stagelinqLogo}
              alt="StageLinq"
              className="h-20 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <Lock className="h-6 w-6" />
            Reset Password
          </CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Invalid Reset Link</span>
              </div>
              <p className="text-sm text-muted-foreground">
                This password reset link is invalid or has expired. Please request a new password reset.
              </p>
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/auth'}
                className="w-full"
                data-testid="button-back-to-login"
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                  data-testid="input-new-password"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  data-testid="input-confirm-password"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={resetPasswordMutation.isPending}
                data-testid="button-reset-password"
              >
                {resetPasswordMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Reset Password
              </Button>
              
              <Button 
                type="button"
                variant="outline"
                onClick={() => window.location.href = '/auth'}
                className="w-full"
                data-testid="button-cancel-reset"
              >
                Cancel
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}