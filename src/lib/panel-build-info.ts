import { readFileSync } from "fs";
import { join } from "path";

export type PanelBuildInfo = {
  app: string;
  panel_ui_revision: string;
  package_version: string;
  node_env: string;
  hint: string;
};

export function getPanelBuildInfo(): PanelBuildInfo {
  let packageVersion = "unknown";
  try {
    const pkgPath = join(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    packageVersion = pkg.version ?? "unknown";
  } catch {
    // ignore
  }

  return {
    app: "secretaria-virtual-panel",
    panel_ui_revision: "sidebar-v2-no-modulos-dividers",
    package_version: packageVersion,
    node_env: process.env.NODE_ENV ?? "unknown",
    hint:
      "Se o layout em /dashboard não bater com isto, o next start pode estar com build antigo: pare o processo, rode npm run build && npm run start, ou use npm run dev.",
  };
}
