import { NavLink, Link } from "react-router-dom";
import { useSubscription } from "../../hooks/useSubscription";
import Icon from "../ui/Icon";

const LINKS = [
  { to: "/app", end: true, ic: "home", label: "Dashboard" },
  { to: "/app/network", end: false, ic: "signal", label: "Network" },
  { to: "/app/history", end: false, ic: "clock", label: "History" },
  { to: "/app/settings", end: false, ic: "settings", label: "Settings" },
];

// Desktop navigation. The Dashboard link carries a live coverage chip so the
// nav reflects wallet/coverage state, per the spec.
export default function SidebarNav() {
  const { isConnected, isActive } = useSubscription();

  return (
    <aside className="sidebar">
      <Link className="brand flex items-center gap-2.5 cursor-pointer group" to="/" title="SpaceShield Home">
        <img
          src="/logo.png"
          alt="SpaceShield Logo"
          style={{
            height: "30px",
            width: "auto",
            objectFit: "contain",
            filter: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.15))",
          }}
          className="transition-transform duration-200 group-hover:scale-105"
        />
        <span className="font-semibold tracking-tight" style={{ color: "var(--ink)" }}>SpaceShield</span>
      </Link>
      <nav className="side-links">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive: active }) => `side-link ${active ? "active" : ""}`}
          >
            <span className="ic">
              <Icon name={l.ic} size={18} />
            </span>
            {l.label}
            {l.to === "/app" && isConnected ? (
              <span className={`tag ${isActive ? "ok" : ""}`} style={{ marginLeft: "auto" }}>
                <span className="dot" />
                {isActive ? "covered" : "open"}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <div className="side-foot">
        Spacecoin → Attestcoin → Creditcoin
        <br />
        automated outage compensation
      </div>
    </aside>
  );
}
