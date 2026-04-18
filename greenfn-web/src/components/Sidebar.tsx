// Fixed left sidebar — collapsible. Expanded: logo + labels. Collapsed: small logo + icons only.
import { NavLink } from "react-router-dom";
import {
  Users,
  TrendingUp,
  CheckSquare,
  MessageSquare,
  Brain,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { to: "/", label: "Contacts Hub", icon: Users, end: true },
  { to: "/pipeline", label: "Leads Pipeline", icon: TrendingUp, end: false },
  { to: "/today", label: "Tasks", icon: CheckSquare, end: false },
  {
    to: "/interaction-history",
    label: "Interaction History",
    icon: MessageSquare,
    end: false,
  },
  { to: "/ai-summary", label: "AI Summary", icon: Brain, end: false },
];

function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "GF";

  const displayName = user?.name ?? "User";

  return (
    <aside
      className={[
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[hsl(142,28%,11%)] bg-[hsl(142,30%,9%)] transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[64px]" : "w-[220px]",
      ].join(" ")}
    >
      {/* Floating collapse handle — vertically centered on sidebar, overhangs right edge */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-4 top-1/2 z-50 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[hsl(142,28%,18%)] bg-[hsl(142,30%,14%)] text-[hsl(142,30%,65%)] shadow-lg transition-all duration-150 hover:border-[hsl(142,45%,34%)] hover:bg-[hsl(142,45%,28%)] hover:text-white"
      >
        {collapsed
          ? <ChevronRight size={13} strokeWidth={3} />
          : <ChevronLeft size={13} strokeWidth={3} />}
      </button>

      {/* Logo area */}
      <div
        className={[
          "flex items-center border-b border-[hsl(142,25%,13%)]",
          collapsed ? "justify-center px-3 py-5" : "px-5 py-5",
        ].join(" ")}
      >
        {collapsed
          ? <img src="/logo_small.png" alt="GreenFN" className="h-8 w-auto" />
          : <img src="/logo.png" alt="GreenFN logo" className="h-100 w-auto" />
        }
      </div>

      {/* Section label — hidden when collapsed */}
      {!collapsed && (
        <div className="px-4 pb-2 pt-7">
          <p className="font-['Sora'] text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(142,35%,55%)]">
            Workspace
          </p>
        </div>
      )}

      {/* Nav items */}
      <nav
        className={[
          "flex flex-1 flex-col gap-1 py-3",
          collapsed ? "items-center px-2" : "px-2",
        ].join(" ")}
      >
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              [
                "flex items-center rounded-lg transition-colors duration-150",
                collapsed
                  ? "h-10 w-10 justify-center"
                  : "w-full gap-3 px-3 py-3",
                isActive
                  ? "bg-[hsl(142,45%,34%)] text-white"
                  : "text-[hsl(142,10%,62%)] hover:bg-[hsl(142,25%,14%)] hover:text-[hsl(142,20%,82%)]",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={collapsed ? 21 : 17}
                  strokeWidth={collapsed ? 2.5 : 2.2}
                  className={isActive ? "text-white" : "text-[hsl(142,18%,52%)]"}
                />
                {!collapsed && (
                  <span className="text-sm font-semibold tracking-tight">{label}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom user section */}
      <div
        className={[
          "border-t border-[hsl(142,25%,13%)]",
          collapsed ? "flex flex-col items-center gap-3 px-2 py-5" : "px-4 py-5",
        ].join(" ")}
      >
        {collapsed ? (
          <>
            <div
              title={displayName}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(142,35%,22%)] text-sm font-bold text-[hsl(142,45%,70%)]"
            >
              {initials}
            </div>
            <button
              type="button"
              title="Logout"
              onClick={() => void logout()}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[hsl(142,12%,40%)] transition-colors hover:bg-[hsl(142,25%,14%)] hover:text-[hsl(0,65%,55%)]"
            >
              <LogOut size={15} strokeWidth={2} />
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Avatar + name row */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(142,35%,22%)] text-sm font-bold text-[hsl(142,45%,70%)]">
                {initials}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold text-[hsl(142,12%,78%)]">
                  {displayName}
                </span>
                <span className="truncate text-xs text-[hsl(142,12%,44%)]">
                  {user?.email ?? ""}
                </span>
              </div>
            </div>
            {/* Logout button — full width */}
            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[hsl(142,12%,44%)] transition-colors hover:bg-[hsl(142,25%,14%)] hover:text-[hsl(0,65%,60%)]"
            >
              <LogOut size={13} strokeWidth={2} />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
