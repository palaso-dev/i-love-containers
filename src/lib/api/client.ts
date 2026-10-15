export const BACKEND_PORT = 41785;

export function getApiUrl(path: string): string {
  if (typeof window !== "undefined") {
    if (window.location.protocol === "http:" && window.location.port === "5173") {
      return path;
    }
  }
  return `http://127.0.0.1:${BACKEND_PORT}${path}`;
}

export function getTerminalWsUrl(
  containerId: string,
  forcePort?: number,
  cols?: number,
  rows?: number,
): string {
  const query = cols && rows ? `?cols=${cols}&rows=${rows}` : "";
  if (forcePort) {
    return `ws://127.0.0.1:${forcePort}/api/containers/${containerId}/pty${query}`;
  }
  if (typeof window !== "undefined") {
    const loc = window.location;
    if (loc.protocol === "http:" && loc.port === "5173") {
      return `ws://${loc.hostname}:5173/api/containers/${containerId}/pty${query}`;
    }
  }
  return `ws://127.0.0.1:${BACKEND_PORT}/api/containers/${containerId}/pty${query}`;
}

export function getAlternateTerminalWsUrl(
  containerId: string,
  cols?: number,
  rows?: number,
): string {
  const query = cols && rows ? `?cols=${cols}&rows=${rows}` : "";
  if (typeof window !== "undefined") {
    const loc = window.location;
    if (loc.protocol === "http:" && loc.port === "5173") {
      return `ws://127.0.0.1:${BACKEND_PORT}/api/containers/${containerId}/pty${query}`;
    }
  }
  return `ws://127.0.0.1:5173/api/containers/${containerId}/pty${query}`;
}

export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const url = input.startsWith("/api") ? getApiUrl(input) : input;
  let attempts = 0;
  while (attempts < 3) {
    try {
      return await fetch(url, init);
    } catch (err) {
      attempts++;
      if (attempts >= 3) throw err;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  return fetch(url, init);
}
