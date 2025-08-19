import { Link, useLocation } from "wouter";

export default function Navigation() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Home", icon: "fas fa-home" },
    { path: "/generator", label: "Generator", icon: "fas fa-link" },
    { path: "/links", label: "Links", icon: "fas fa-list" }
  ];

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
            <span className="va-text-green font-bold text-lg">Virtual Audience HUB</span>
          </div>
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
        </div>
      </div>
    </nav>
  );
}
