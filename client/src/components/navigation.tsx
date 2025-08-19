import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Settings } from "lucide-react";

export default function Navigation() {
  const [location] = useLocation();
  const { user, isLoading, logoutMutation } = useAuth();

  const navItems = user ? [
    { path: "/", label: "Home", icon: "fas fa-home" },
    { path: "/generator", label: "Generator", icon: "fas fa-link" },
    { path: "/links", label: "Links", icon: "fas fa-list" }
  ] : [];

  // Only show admin nav item for admin users
  if (user?.role === 'admin') {
    navItems.push({ path: "/admin", label: "Admin", icon: "fas fa-cog" });
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Don't show navigation on auth page
  if (location === '/auth') {
    return null;
  }

  return (
    <nav className="va-bg-dark-surface border-b va-border-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <img 
              src="https://cdn2.obedtv.live:8088/obedtv.png" 
              alt="OBTV Logo" 
              className="h-8 w-auto mr-3 rounded"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://images.unsplash.com/photo-1611162617474-5b21e879e113?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=52";
              }}
            />
            <span className="va-text-green font-bold text-lg">StageLinQ</span>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Navigation Links */}
            {user && (
              <div className="flex space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`transition-colors duration-200 ${
                      location === item.path
                        ? "va-text-green"
                        : "va-text-secondary hover:va-text-green"
                    }`}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    <i className={`${item.icon} mr-2`}></i>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}

            {/* User Menu */}
            {!isLoading && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2" data-testid="user-menu">
                    <User className="h-4 w-4" />
                    <span>{user.username}</span>
                    <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className="text-xs">
                      {user.role}
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {user.role === 'admin' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center">
                          <Settings className="mr-2 h-4 w-4" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                    data-testid="button-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : !isLoading && !user ? (
              <Link href="/auth">
                <Button variant="outline" data-testid="button-login">
                  Sign In
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
