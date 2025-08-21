import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Redirect } from "wouter";
import { Loader2, Monitor, Users, Zap } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";

import stagelinq_logo from "@assets/stagelinq_logo.png";

export default function AuthPage() {
  const { user, isLoading, loginMutation, registerMutation } = useAuth();
  const { isMobile } = useMobile();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    role: "user" as "admin" | "user",
  });

  // Redirect if already logged in
  if (!isLoading && user) {
    return <Redirect to="/" />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLogin) {
      loginMutation.mutate({
        username: formData.username,
        password: formData.password,
      });
    } else {
      registerMutation.mutate({
        username: formData.username,
        password: formData.password,
        email: formData.email || undefined,
        role: formData.role,
      });
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
                {isLogin ? "Welcome Back" : "Create Account"}
              </CardTitle>
              <CardDescription className="text-sm">
                {isLogin 
                  ? "Sign in to continue"
                  : "Join the platform"
                }
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

                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm">Email (Optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className="h-12 text-base"
                        data-testid="input-email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-sm">Role</Label>
                      <Select 
                        value={formData.role} 
                        onValueChange={(value: "admin" | "user") => handleInputChange("role", value)}
                      >
                        <SelectTrigger className="h-12" data-testid="select-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium"
                  disabled={loginMutation.isPending || registerMutation.isPending}
                  data-testid="button-submit"
                >
                  {(loginMutation.isPending || registerMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isLogin ? "Sign In" : "Create Account"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-foreground touch-target"
                  data-testid="button-toggle-form"
                >
                  {isLogin 
                    ? "Don't have an account? Sign up" 
                    : "Already have an account? Sign in"
                  }
                </button>
              </div>
            </CardContent>
          </Card>
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
              {isLogin ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <CardDescription>
              {isLogin 
                ? "Sign in to your Virtual Audience account"
                : "Join the Virtual Audience platform"
              }
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

              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (Optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      data-testid="input-email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select 
                      value={formData.role} 
                      onValueChange={(value: "admin" | "user") => handleInputChange("role", value)}
                    >
                      <SelectTrigger data-testid="select-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending || registerMutation.isPending}
                data-testid="button-submit"
              >
                {(loginMutation.isPending || registerMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-foreground"
                data-testid="button-toggle-form"
              >
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"
                }
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Right side - Hero */}
      <div className="flex-1 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="flex justify-center mb-6">
            <img 
              src="/stagelinq_logo.png" 
              alt="StageLinq Logo" 
              className="h-[30rem] w-auto mt-[-179px] mb-[-179px]"
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