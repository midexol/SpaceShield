import { Routes, Route } from "react-router-dom";
import Landing from "./screens/Landing";
import AppLayout from "./components/nav/AppLayout";
import Dashboard from "./screens/Dashboard";
import Network from "./screens/Network";
import History from "./screens/History";
import Vision from "./screens/Vision";
import Demo from "./screens/Demo";
import Settings from "./screens/Settings";
import Privacy from "./screens/Privacy";
import NotFound from "./screens/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="network" element={<Network />} />
        <Route path="history" element={<History />} />
        <Route path="vision" element={<Vision />} />
        <Route path="demo" element={<Demo />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
