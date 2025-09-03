import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import Navigation from "@/components/navigation";
import Home from "@/pages/home";
import Generator from "@/pages/generator";
import Session from "@/pages/session";
import Links from "@/pages/links";
import Viewer from "@/pages/viewer";
import StudioViewer from "@/pages/studio-viewer";
import Room from "@/pages/room";
import RoomFullscreen from "@/pages/room-fullscreen";
import RoomManage from "@/pages/room-manage";
import Rooms from "@/pages/rooms";
import MobileTest from "@/pages/mobile-test";
import AuthPage from "@/pages/auth-page";
import RegisterPage from "@/pages/register-page";
import AdminPage from "@/pages/admin-page";
import ProfilePage from "@/pages/profile-page";
import ResetPasswordPage from "@/pages/reset-password-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen bg-va-dark-bg text-va-text-primary font-inter">
      <Navigation />
      <Switch>
        <ProtectedRoute path="/" component={Home} />
        <ProtectedRoute path="/generator" component={Generator} />
        <ProtectedRoute path="/links" component={Links} />
        <ProtectedRoute path="/rooms" component={Rooms} />
        <ProtectedRoute path="/room/:id" component={Room} />
        <ProtectedRoute path="/room/:id/fullscreen" component={RoomFullscreen} />
        <ProtectedRoute path="/room/:id/manage" component={RoomManage} />
        <ProtectedRoute path="/profile" component={ProfilePage} />
        <ProtectedRoute path="/admin" component={AdminPage} adminOnly />
        <Route path="/session" component={Session} />
        <Route path="/viewer" component={Viewer} />
        <Route path="/studio-viewer" component={StudioViewer} />
        <Route path="/mobile-test" component={MobileTest} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
