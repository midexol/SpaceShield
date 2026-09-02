import { Routes, Route } from "react-router-dom";
import Landing from "./screens/Landing";
import AppLayout from "./components/nav/AppLayout";
import Dashboard from "./screens/Dashboard";
import Network from "./screens/Network";
import History from "./screens/History";
import Vision from "./screens/Vision";
import Settings from "./screens/Settings";
import Privacy from "./screens/Privacy";
import NotFound from "./screens/NotFound";

// "/" is the marketing landing page (its own top nav). "/app/*" is the
// wallet-connected dApp, wrapped in the responsive AppLayout (sidebar on
// desktop, bottom-tab bar on mobile). "/privacy" is a standalone legal page,
// and any unknown path renders the custom 404.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="network" element={<Network />} />
        <Route path="history" element={<History />} />
        <Route path="vision" element={<Vision />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
