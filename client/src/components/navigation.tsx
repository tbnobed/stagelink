import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Settings, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Navigation() {
  const [location] = useLocation();
  const { user, isLoading, logoutMutation } = useAuth();
  const { isMobile } = useMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = user ? [
    { path: "/", label: "Home", icon: "fas fa-home" },
    { path: "/generator", label: "Generator", icon: "fas fa-link" },
    { path: "/links", label: "Links", icon: "fas fa-list" },
    { path: "/rooms", label: "Rooms", icon: "fas fa-video" }
  ] : [];

  // Only show admin nav item for admin users
  if (user?.role === 'admin') {
    navItems.push({ path: "/admin", label: "Admin", icon: "fas fa-cog" });
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Don't show navigation on auth page, session, viewer, or reset password pages
  if (location === '/auth' || location === '/session' || location === '/viewer' || location === '/studio-viewer' || location === '/reset-password') {
    return null;
  }

  // Mobile Navigation
  if (isMobile) {
    return (
      <nav className="mobile-nav va-bg-dark-surface border-b va-border-dark relative">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <img 
              src="https://cdn2.obedtv.live:8088/obedtv.png" 
              alt="OBTV Logo" 
              className="h-6 w-auto mr-2 rounded"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://images.unsplash.com/photo-1611162617474-5b21e879e113?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=52";
              }}
            />
            <span className="va-text-green font-bold text-base">StageLinQ</span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="btn-touch p-2"
            data-testid="button-mobile-menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
        
        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 va-bg-dark-surface-2 border-t va-border-dark z-50 shadow-lg">
            <div className="px-4 py-2 space-y-1 max-h-96 overflow-y-auto">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <div 
                    className={`flex items-center px-3 py-3 rounded-md text-base ${
                      location === item.path 
                        ? 'va-bg-primary va-text-dark' 
                        : 'va-text-secondary hover:va-text-primary hover:va-bg-dark-surface'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <i className={`${item.icon} mr-3`}></i>
                    {item.label}
                  </div>
                </Link>
              ))}
              
              {user && (
                <>
                  <div className="border-t va-border-dark my-2"></div>
                  <div className="flex items-center px-3 py-3">
                    <User className="w-4 h-4 mr-3" />
                    <span className="va-text-primary">{user.username}</span>
                    {user.role === 'admin' && (
                      <Badge variant="secondary" className="ml-2 text-xs">Admin</Badge>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center px-3 py-3 va-text-secondary hover:va-text-primary w-full text-left"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    );
  }

  // Desktop Navigation
  return (
    <nav className="desktop-only va-bg-dark-surface border-b va-border-dark">
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
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center">
                          <Settings className="mr-2 h-4 w-4" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
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
