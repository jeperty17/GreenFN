// Root layout: fixed sidebar + block-level main that fills the remaining viewport.
import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[hsl(140,20%,97%)]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      {/*
        Block-level main with margin-left matching the sidebar width.
        As a block element, width = 100vw − margin-left automatically.
        No flex needed — that's the correct layout for a fixed sidebar.
      */}
      <main
        className={[
          "min-h-screen px-6 py-6 transition-[margin-left] duration-200 ease-in-out",
          collapsed ? "ml-[64px]" : "ml-[220px]",
        ].join(" ")}
      >
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
