import { useEffect } from "react";

// Dependency-free per-route document metadata. Sets a unique <title> and
// <meta name="description">, and keeps the Open Graph / Twitter mirrors in sync
// when those tags exist (they're declared in index.html). Restores the previous
// values on unmount so route changes don't leak stale metadata.
//
// Chosen over react-helmet deliberately: no extra dependency, no reinstall, and
// the app only ever needs title + description per route.

const BRAND = "SpaceShield";
const DEFAULT_TITLE = `${BRAND} — Autonomous SLA Enforcement for Satellite Internet`;

function setContent(selector, value) {
  const el = document.head.querySelector(selector);
  if (!el || value == null) return null;
  const prev = el.getAttribute("content");
  el.setAttribute("content", value);
  return () => {
    if (prev != null) el.setAttribute("content", prev);
  };
}

export function useDocumentMeta(title, description) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${BRAND}` : DEFAULT_TITLE;
    const prevTitle = document.title;
    document.title = fullTitle;

    const restorers = [
      description != null ? setContent('meta[name="description"]', description) : null,
      setContent('meta[property="og:title"]', fullTitle),
      description != null ? setContent('meta[property="og:description"]', description) : null,
      setContent('meta[name="twitter:title"]', fullTitle),
      description != null ? setContent('meta[name="twitter:description"]', description) : null,
    ].filter(Boolean);

    return () => {
      document.title = prevTitle;
      restorers.forEach((restore) => restore());
    };
  }, [title, description]);
}
