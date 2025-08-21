import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import stagelinqLogo from "@assets/stagelinq_logo_transparent_1755626228653.png";

interface RegistrationToken {
  valid: boolean;
  email: string;
  role: string;
}

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [token, setToken] = useState<string>("");
  const [tokenData, setTokenData] = useState<RegistrationToken | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string>("");
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  // Get token from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    if (tokenParam) {
      setToken(tokenParam);
      validateToken(tokenParam);
    }
  }, []);

  const validateToken = async (tokenValue: string) => {
    setIsValidatingToken(true);
    setTokenError("");
    
    try {
      const response = await fetch(`/api/registration/validate-token/${tokenValue}`);
      const data = await response.json();
      
      if (response.ok && data.valid) {
        setTokenData(data);
      } else {
        setTokenError(data.error || 'Invalid registration token');
      }
    } catch (error) {
      setTokenError('Failed to validate registration token');
    } finally {
      setIsValidatingToken(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username",
        variant: "destructive",
      });
      return;
    }
    
    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please ensure both passwords are identical",
        variant: "destructive",
      });
      return;
    }
    
    setIsRegistering(true);
    
    try {
      const response = await fetch('/api/registration/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          username,
          password,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setIsRegistered(true);
        toast({
          title: "Registration successful!",
          description: "Your account has been created. You can now log in.",
        });
        
        // Redirect to login page after 2 seconds
        setTimeout(() => {
          setLocation('/auth');
        }, 2000);
      } else {
        toast({
          title: "Registration failed",
          description: data.error || "Failed to complete registration",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Registration failed",
        description: "An error occurred during registration",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'engineer': return 'Engineer';
      default: return 'User';
    }
  };

  if (isValidatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-center text-muted-foreground">Validating registration token...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img 
              src={stagelinqLogo} 
              alt="StageLinq Logo" 
              className="w-48 h-auto mx-auto mb-4" 
            />
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{tokenError}</AlertDescription>
            </Alert>
            <div className="mt-6 text-center">
              <Button 
                onClick={() => setLocation('/auth')}
                variant="outline"
                className="w-full"
              >
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img 
              src={stagelinqLogo} 
              alt="StageLinq Logo" 
              className="w-48 h-auto mx-auto mb-4" 
            />
            <CardTitle className="text-green-600 flex items-center justify-center gap-2">
              <CheckCircle className="h-6 w-6" />
              Registration Complete!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                Your account has been created successfully. You will be redirected to the login page shortly.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img 
            src={stagelinqLogo} 
            alt="StageLinq Logo" 
            className="w-48 h-auto mx-auto mb-4" 
          />
          <CardTitle>Complete Your Registration</CardTitle>
          <CardDescription>
            You've been invited to join StageLinq as a {getRoleDisplayName(tokenData?.role || '')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Email:</strong> {tokenData?.email}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Role:</strong> {getRoleDisplayName(tokenData?.role || '')}
            </p>
          </div>

          <form onSubmit={handleRegistration} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isRegistering}
                data-testid="input-username"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isRegistering}
                data-testid="input-password"
                minLength={6}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isRegistering}
                data-testid="input-confirm-password"
                minLength={6}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isRegistering || !username.trim() || !password || !confirmPassword}
              data-testid="button-register"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button 
              variant="outline" 
              onClick={() => setLocation('/auth')}
              className="text-sm"
              data-testid="link-login"
            >
              Already have an account? Log in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}