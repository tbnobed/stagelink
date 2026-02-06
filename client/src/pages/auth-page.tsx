import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Redirect } from "wouter";
import { Loader2, ArrowLeft, Mail, Eye, EyeOff } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

import stagelinq_logo from "@assets/stagelinq_logo.png";

export default function AuthPage() {
  const { user, isLoading, loginMutation } = useAuth();
  const { isMobile } = useMobile();
  const { toast } = useToast();
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    setFormData(prev => ({ ...prev, [field]: value }));
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
      <div className="flex items-center justify-center min-h-screen bg-[hsl(0,0%,5%)]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(159,100%,41%)]" />
      </div>
    );
  }

  const passwordResetModal = showPasswordReset && (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-sm bg-[hsl(0,0%,10%)] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setShowPasswordReset(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            data-testid="button-close-password-reset"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-semibold text-white">Reset Password</h2>
        </div>
        <p className="text-sm text-white/50 mb-5">
          Enter your email to receive a password reset link.
        </p>
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reset-email" className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Email Address
            </Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="you@company.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[hsl(159,100%,41%)] focus:ring-1 focus:ring-[hsl(159,100%,41%)]/20 rounded-xl"
              data-testid="input-reset-email"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-11 bg-[hsl(159,100%,41%)] hover:bg-[hsl(159,100%,35%)] text-black font-semibold rounded-xl transition-all"
            disabled={passwordResetMutation.isPending}
            data-testid="button-send-reset-email"
          >
            {passwordResetMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            Send Reset Link
          </Button>
        </form>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,5%)] flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="flex justify-center mb-8">
              <img
                src={stagelinq_logo}
                alt="StageLinq Logo"
                className="h-20 w-auto object-contain"
                data-testid="stagelinq-logo-mobile"
              />
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-1">
                Welcome back
              </h1>
              <p className="text-sm text-white/40">
                Sign in to your account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-medium text-white/60 uppercase tracking-wider">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  required
                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[hsl(159,100%,41%)] focus:ring-1 focus:ring-[hsl(159,100%,41%)]/20 rounded-xl text-base"
                  data-testid="input-username"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-white/60 uppercase tracking-wider">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    required
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[hsl(159,100%,41%)] focus:ring-1 focus:ring-[hsl(159,100%,41%)]/20 rounded-xl pr-10 text-base"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[hsl(159,100%,41%)] hover:bg-[hsl(159,100%,35%)] text-black font-semibold text-base rounded-xl transition-all"
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
                className="text-sm text-white/30 hover:text-[hsl(159,100%,41%)] transition-colors"
                data-testid="button-forgot-password"
              >
                Forgot your password?
              </button>
            </div>
          </div>
        </div>
        {passwordResetModal}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,5%)] flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                required
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[hsl(159,100%,41%)] focus:ring-1 focus:ring-[hsl(159,100%,41%)]/20 rounded-xl"
                data-testid="input-username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  required
                  className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[hsl(159,100%,41%)] focus:ring-1 focus:ring-[hsl(159,100%,41%)]/20 rounded-xl pr-10"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-[hsl(159,100%,41%)] hover:bg-[hsl(159,100%,35%)] text-black font-semibold rounded-xl transition-all"
              disabled={loginMutation.isPending}
              data-testid="button-submit"
            >
              {loginMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Sign In
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setShowPasswordReset(true)}
              className="text-sm text-white/30 hover:text-[hsl(159,100%,41%)] transition-colors"
              data-testid="button-forgot-password-desktop"
            >
              Forgot your password?
            </button>
          </div>
        </div>

        {passwordResetModal}
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(0,0%,8%) 0%, hsl(159,30%,8%) 50%, hsl(0,0%,5%) 100%)' }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="relative text-center px-12">
          <div className="flex justify-center mb-10">
            <div className="relative">
              <div className="absolute -inset-6 bg-[hsl(159,100%,41%)]/10 rounded-full blur-2xl" />
              <img
                src={stagelinq_logo}
                alt="StageLinq Logo"
                className="relative h-28 w-auto object-contain"
                data-testid="stagelinq-logo"
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
            StageLinq
          </h1>
          <p className="text-white/30 text-sm max-w-xs mx-auto leading-relaxed">
            Virtual Audience Platform
          </p>
          <div className="mt-10 flex items-center justify-center gap-8 text-white/20 text-xs uppercase tracking-widest">
            <span>Live</span>
            <span className="w-1 h-1 rounded-full bg-[hsl(159,100%,41%)]" />
            <span>Stream</span>
            <span className="w-1 h-1 rounded-full bg-[hsl(159,100%,41%)]" />
            <span>Connect</span>
          </div>
        </div>
      </div>
    </div>
  );
}