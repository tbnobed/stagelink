import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navigation from "@/components/navigation";
import Home from "@/pages/home";
import Generator from "@/pages/generator";
import Session from "@/pages/session";
import Links from "@/pages/links";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen bg-va-dark-bg text-va-text-primary font-inter">
      <Navigation />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/generator" component={Generator} />
        <Route path="/session" component={Session} />
        <Route path="/links" component={Links} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
