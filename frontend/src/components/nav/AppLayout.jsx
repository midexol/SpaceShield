import { Outlet, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import SidebarNav from "./SidebarNav";
import BottomTabNav from "./BottomTabNav";
import Breadcrumbs from "./Breadcrumbs";
import { useNetwork } from "../../hooks/useNetwork";
import { Tag } from "../ui/Badge";

const TITLES = {
  "/app": "Dashboard",
  "/app/network": "Network",
  "/app/history": "History",
  "/app/settings": "Settings",
};

// The dApp shell: sticky top bar with the RainbowKit connect button, a desktop
// sidebar, and a mobile bottom-tab bar. The routed screen renders in <Outlet/>.
export default function AppLayout() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] || "SpaceShield";
  const { deployed } = useNetwork();

  return (
    <div className="app-shell">
      <SidebarNav />
      <div className="app-main">
        <header className="app-topbar">
          <div className="page-title">{title}</div>
          <div className="topbar-right">
            {!deployed ? <Tag tone="warn">network not deployed</Tag> : null}
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
          </div>
        </header>
        <main className="app-content">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
      <BottomTabNav />
    </div>
  );
}
