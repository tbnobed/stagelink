import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Redirect } from "wouter";
import { Loader2, Monitor, Users, Zap, ArrowLeft, Mail } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

import stagelinq_logo from "@assets/stagelinq_logo.png";

export default function AuthPage() {
  const { user, isLoading, loginMutation } = useAuth();
  const { isMobile } = useMobile();
  const { toast } = useToast();
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const passwordResetMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/password-reset/request", { email });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Password reset email sent",
        description: data.message,
      });
      setShowPasswordReset(false);
      setResetEmail("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send reset email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Redirect if already logged in
  if (!isLoading && user) {
    return <Redirect to="/" />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    loginMutation.mutate({
      username: formData.username,
      password: formData.password,
    });
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }
    passwordResetMutation.mutate(resetEmail);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Mobile Header with Logo */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 px-4 py-4 text-center">
          <div className="flex justify-center mb-2">
            <img 
              src={stagelinq_logo} 
              alt="StageLinq Logo" 
              className="h-[300px] w-auto mt-[-46px] mb-[-46px] ml-[-5px] mr-[-5px] pl-[19px] pr-[19px] pt-[70px] pb-[70px]"
              data-testid="stagelinq-logo-mobile"
            />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-1">
            StageLinq Platform
          </h1>
          <p className="text-sm text-muted-foreground">
            Professional live streaming solution
          </p>
        </div>
        {/* Mobile Form */}
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl font-bold">
                Welcome Back
              </CardTitle>
              <CardDescription className="text-sm">
                Sign in to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter username"
                    value={formData.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    required
                    className="h-12 text-base"
                    data-testid="input-username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    required
                    className="h-12 text-base"
                    data-testid="input-password"
                  />
                </div>



                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium"
                  disabled={loginMutation.isPending}
                  data-testid="button-submit"
                >
                  {loginMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Sign In
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(true)}
                  className="text-sm text-muted-foreground hover:text-foreground touch-target"
                  data-testid="button-forgot-password"
                >
                  Forgot your password?
                </button>
              </div>
            </CardContent>
          </Card>
          
          {/* Password Reset Modal for Mobile */}
          {showPasswordReset && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPasswordReset(false)}
                      className="p-2"
                      data-testid="button-close-password-reset"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle className="text-lg">Reset Password</CardTitle>
                    <div className="w-8" />
                  </div>
                  <CardDescription className="text-sm">
                    Enter your email to receive a password reset link
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email" className="text-sm">Email Address</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="Enter your email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        className="h-12 text-base"
                        data-testid="input-reset-email"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-medium"
                      disabled={passwordResetMutation.isPending}
                      data-testid="button-send-reset-email"
                    >
                      {passwordResetMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <Mail className="mr-2 h-4 w-4" />
                      Send Reset Link
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        {/* Mobile Feature List */}
        <div className="px-4 pb-8">
          <div className="max-w-sm mx-auto space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Monitor className="w-3 h-3 text-primary flex-shrink-0" />
              <span>WHIP/WHEP Protocol Support</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-3 h-3 text-primary flex-shrink-0" />
              <span>Live Chat Integration</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-primary flex-shrink-0" />
              <span>QR Code Link Generation</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              Welcome Back
            </CardTitle>
            <CardDescription>
              Sign in to your Virtual Audience account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  required
                  data-testid="input-username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>



              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-submit"
              >
                {loginMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Sign In
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowPasswordReset(true)}
                className="text-sm text-muted-foreground hover:text-foreground"
                data-testid="button-forgot-password-desktop"
              >
                Forgot your password?
              </button>
            </div>
          </CardContent>
        </Card>
        
        {/* Password Reset Modal for Desktop */}
        {showPasswordReset && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPasswordReset(false)}
                    className="p-2"
                    data-testid="button-close-password-reset-desktop"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="text-xl">Reset Password</CardTitle>
                  <div className="w-8" />
                </div>
                <CardDescription>
                  Enter your email to receive a password reset link
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email-desktop">Email Address</Label>
                    <Input
                      id="reset-email-desktop"
                      type="email"
                      placeholder="Enter your email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      data-testid="input-reset-email-desktop"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={passwordResetMutation.isPending}
                    data-testid="button-send-reset-email-desktop"
                  >
                    {passwordResetMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Mail className="mr-2 h-4 w-4" />
                    Send Reset Link
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      {/* Right side - Hero */}
      <div className="flex-1 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="flex justify-center mb-6">
            <img 
              src={stagelinq_logo} 
              alt="StageLinq Logo" 
              className="h-48 w-auto object-contain"
              data-testid="stagelinq-logo"
            />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-4">
            Virtual Audience Platform
          </h1>
          <p className="text-muted-foreground mb-6">
            Professional live streaming solution with real-time video publishing, 
            audience interaction, and comprehensive stream management capabilities.
          </p>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>WHIP/WHEP Protocol Support</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Live Chat Integration</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>QR Code Link Generation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}