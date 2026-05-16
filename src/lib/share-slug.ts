import { randomBytes } from "crypto";

export function generateShareSlug(): string {
  return randomBytes(9).toString("base64url");
}
