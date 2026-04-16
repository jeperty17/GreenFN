import { NavLink, Outlet } from "react-router-dom";

const navLinks = [
  { to: "/", label: "Contacts Hub" },
  { to: "/pipeline", label: "Leads Pipeline" },
  { to: "/today", label: "Tasks" },
  { to: "/interaction-history", label: "Interaction History" },
  { to: "/ai-summary", label: "AI Summary" },
];

function AppLayout() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-6 py-6">
      <header className="mb-8 rounded-lg border bg-card p-6 text-card-foreground">
        <h1>GreenFN</h1>
        <nav className="mt-4">
          <ul className="flex flex-wrap gap-2">
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    [
                      "inline-flex rounded-md border px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
                    ].join(" ")
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
