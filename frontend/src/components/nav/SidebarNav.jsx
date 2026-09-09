import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import { useSubscription } from "../../hooks/useSubscription";
import Icon from "../ui/Icon";

const LINKS = [
  { to: "/app", end: true, ic: "home", label: "Dashboard" },
  { to: "/app/network", end: false, ic: "signal", label: "Network" },
  { to: "/app/history", end: false, ic: "clock", label: "History" },
  { to: "/app/vision", end: false, ic: "compass", label: "Vision" },
  { to: "/app/demo", end: false, ic: "activity", label: "Demo" },
  { to: "/app/settings", end: false, ic: "settings", label: "Settings" },
];

export default function SidebarNav() {
  const { isConnected, isActive } = useSubscription();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("spaceshield_sidebar_collapsed") === "true";
  });

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("spaceshield_sidebar_collapsed", String(next));
      return next;
    });
  };

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header flex items-center justify-between">
        <Link className="brand flex items-center gap-2.5 cursor-pointer group" to="/" title="SpaceShield Home">
          <img
            src="/logo.png"
            alt="SpaceShield Logo"
            style={{
              height: "28px",
              width: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.15))",
            }}
            className="transition-transform duration-200 group-hover:scale-105 flex-shrink-0"
          />
          {!collapsed && (
            <span className="font-semibold tracking-tight brand-text" style={{ color: "var(--ink)" }}>
              SpaceShield
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggleCollapse}
          className="collapse-toggle-btn p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon name={collapsed ? "chevronRight" : "chevronLeft"} size={18} />
        </button>
      </div>

      <nav className="side-links">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            title={collapsed ? l.label : undefined}
            className={({ isActive: active }) => `side-link ${active ? "active" : ""}`}
          >
            <span className="ic">
              <Icon name={l.ic} size={18} />
            </span>
            {!collapsed && <span className="link-label">{l.label}</span>}
            {l.to === "/app" && isConnected ? (
              <span className={`tag ${isActive ? "ok" : ""}`} style={{ marginLeft: "auto" }}>
                <span className="dot" />
                {!collapsed && (isActive ? "covered" : "open")}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="side-foot">
          Spacecoin → Attestcoin → Creditcoin
          <br />
          automated outage compensation
        </div>
      )}
    </aside>
  );
}
