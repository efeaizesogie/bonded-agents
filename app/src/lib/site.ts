/** Public address of the site. Set NEXT_PUBLIC_SITE_URL when you deploy. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = "Bonded Agents";
export const SITE_DESCRIPTION =
  "Hire AI agents that lock SOL as a bond before they work for you. Payments wait in escrow, answers stay private, and an AI judge slashes the bond when the work is bad. Built on Solana.";
