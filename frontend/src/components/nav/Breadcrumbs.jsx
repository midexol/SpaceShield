import { Link, useLocation } from "react-router-dom";
import Icon from "../ui/Icon";

const LABELS = { network: "Network", history: "History", settings: "Settings" };

// App breadcrumbs: Home / Dashboard / <Section>. The trailing crumb is the
// current page and renders as plain text (not a link).
export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const seg = pathname.replace(/^\/app\/?/, "").split("/")[0]; // "", "network", ...

  const crumbs = [
    { label: "Home", to: "/" },
    { label: "Dashboard", to: "/app" },
  ];
  if (seg) crumbs.push({ label: LABELS[seg] || seg, to: pathname });

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.to}>
              {last ? (
                <span aria-current="page">{c.label}</span>
              ) : (
                <>
                  <Link to={c.to}>{c.label}</Link>
                  <Icon name="chevronRight" size={13} className="crumb-sep" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
