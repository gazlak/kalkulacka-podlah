import type { ReactNode } from "react";

/** Auth obrazovky bez lišt. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main id="app">{children}</main>;
}
