import { execSync } from "node:child_process";

/** V režimu http začíná každý běh od čisté, nasazené DB (stejná ukázková data jako mock). */
export default function setup() {
  if (process.env.E2E_API === "http") execSync("npm run db:reset", { stdio: "ignore" });
}
