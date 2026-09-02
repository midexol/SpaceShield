import { NavLink } from "react-router-dom";
import Icon from "../ui/Icon";

const TABS = [
  { to: "/app", end: true, ic: "home", label: "Home" },
  { to: "/app/network", end: false, ic: "signal", label: "Network" },
  { to: "/app/history", end: false, ic: "clock", label: "History" },
  { to: "/app/vision", end: false, ic: "compass", label: "Vision" },
  { to: "/app/settings", end: false, ic: "settings", label: "Profile" },
];

// Mobile navigation (shown under 820px; hidden on desktop via CSS).
export default function BottomTabNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => `tab-link ${isActive ? "active" : ""}`}
        >
          <span className="ic">
            <Icon name={t.ic} size={20} />
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
