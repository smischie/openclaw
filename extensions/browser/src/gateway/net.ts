export { isLoopbackHost } from "../sdk-node-runtime.js";

/** Returns true when the IP string is a loopback address (127.x.x.x or ::1). */
export function isLoopbackAddress(ip: string | undefined): boolean {
  if (!ip) return false;
  const trimmed = ip.trim();
  return trimmed === "::1" || trimmed.startsWith("127.");
}
