/**
 * Lexora Experience 4.0 deterministic visual contract.
 * Static checks only: no database, browser, AI, or network calls.
 */
import fs from "fs";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) console.log(`  PASS  ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const read = (path: string) => fs.readFileSync(path, "utf8");
const exists = (path: string) => fs.existsSync(path);

const css = read("client/src/index.css");

console.log("Lexora Experience 4.0 visual contract\n");

for (const value of ["#0B090C","#131015","#1A151C","#7E3E51","#A55B70","#C0A06B","#EFE5D9","#BCAF9F"]) {
  check(`palette includes ${value}`, css.includes(value));
}

const components = [
  ["LexoraPageHeader","client/src/components/experience/lexora-page-header.tsx"],
  ["EditorialSection","client/src/components/experience/editorial-section.tsx"],
  ["CreativeMetric","client/src/components/experience/creative-metric.tsx"],
  ["EmptyCreativeState","client/src/components/experience/empty-creative-state.tsx"],
] as const;

for (const [name,path] of components) {
  check(`${name} exists`, exists(path));
  if (exists(path)) {
    const source = read(path);
    check(`${name} exports its interface`, source.includes(`export function ${name}`) || source.includes(`export const ${name}`));
    check(`${name} avoids legacy primary neon`, !source.includes("purple-500") && !source.includes("cyan-400"));
  }
}

for (const utility of [".lexora-page",".lexora-editorial-surface",".lexora-kicker",".lexora-divider",".lexora-cover-placeholder"]) {
  check(`shared utility ${utility} exists`, css.includes(utility));
}

check("reduced motion remains supported", css.includes("prefers-reduced-motion"));

const app = read("client/src/App.tsx");
const sidebar = read("client/src/components/app-sidebar.tsx");
check("shell keeps Stories become worlds orientation", app.includes("Stories become worlds."));
check("sidebar uses Lexora mark", sidebar.includes("/icons/lexora-mark.svg"));
check("sidebar defines primary creative navigation", sidebar.includes("primaryNavItems"));
check("sidebar defines secondary intelligence navigation", sidebar.includes("secondaryNavItems"));
check("sidebar retains narration integration", sidebar.includes("narrationState") && sidebar.includes("playbackControls"));
check("app retains Lexora Copilot", app.includes("LexoraCopilot"));
check("sidebar primary active style avoids purple neon", !sidebar.includes('bg-purple-500/10 text-purple-300'));

const coverCardPath = "client/src/components/experience/project-cover-card.tsx";
check("ProjectCoverCard exists", exists(coverCardPath));
if (exists(coverCardPath)) {
  const coverCard = read(coverCardPath);
  check("ProjectCoverCard exports component", coverCard.includes("export function ProjectCoverCard"));
  check("ProjectCoverCard handles missing covers deliberately", coverCard.includes("lexora-cover-placeholder"));
  check("ProjectCoverCard supports compact mode", coverCard.includes("compact?: boolean"));
  check("ProjectCoverCard bounds long titles", coverCard.includes("line-clamp-2") || coverCard.includes("truncate"));
} 

const dashboard = read("client/src/pages/Dashboard.tsx");
check("dashboard names Continue Creating", dashboard.includes("Continue Creating"));
check("dashboard names Recent Worlds", dashboard.includes("Recent Worlds"));
check("dashboard names Creative Pulse", dashboard.includes("Creative Pulse"));
check("dashboard uses ProjectCoverCard", dashboard.includes("ProjectCoverCard"));
check("dashboard uses EmptyCreativeState", dashboard.includes("EmptyCreativeState"));
check("dashboard removed legacy neon stat config", !dashboard.includes("neon-glow-cool") && !dashboard.includes("glow-text-cyan"));

const library = read("client/src/pages/Library.tsx");
check("library defines 4.0 view modes", library.includes('type LibraryView = "covers" | "editorial" | "compact"'));
check("library uses ProjectCoverCard", library.includes("ProjectCoverCard"));
check("library uses EmptyCreativeState", library.includes("EmptyCreativeState"));
check("library keeps search", library.includes("input-library-search"));
check("library keeps exports", library.includes("ExportMenu"));
check("library avoids fixed-height clipping", !library.includes("h-screen overflow-hidden"));

const mobileNavPath = "client/src/components/experience/mobile-bottom-nav.tsx";
check("mobile bottom nav exists", exists(mobileNavPath));
if (exists(mobileNavPath)) {
  const mobileNav = read(mobileNavPath);
  check("mobile nav includes Home and Library", mobileNav.includes("Home") && mobileNav.includes("Library"));
  check("mobile nav avoids unimplemented routes", !mobileNav.includes('"/worlds"') && !mobileNav.includes('"/characters"') && !mobileNav.includes('"/cinema"') && !mobileNav.includes('"/research"'));
  check("mobile nav respects safe area", mobileNav.includes("safe-area-inset-bottom"));
}
check("app mounts mobile navigation", app.includes("MobileBottomNav"));
check("app reserves mobile navigation space", app.includes("pb-[4.5rem]") || app.includes("pb-[72px]"));

const projectHeroPath = "client/src/components/experience/project-hero.tsx";
check("ProjectHero exists", exists(projectHeroPath));
if (exists(projectHeroPath)) {
  const projectHero = read(projectHeroPath);
  check("ProjectHero exports component", projectHero.includes("export function ProjectHero"));
  check("ProjectHero handles missing covers", projectHero.includes("lexora-cover-placeholder"));
  check("ProjectHero bounds long titles", projectHero.includes("line-clamp") || projectHero.includes("break-words"));
  check("ProjectHero avoids legacy primary neon", !projectHero.includes("purple-500") && !projectHero.includes("cyan-400"));
}

const workspaceTabsPath = "client/src/components/experience/workspace-tabs.tsx";
check("WorkspaceTabs exists", exists(workspaceTabsPath));
if (exists(workspaceTabsPath)) {
  const workspaceTabs = read(workspaceTabsPath);
  check("WorkspaceTabs exports component", workspaceTabs.includes("export function WorkspaceTabs"));
  check("WorkspaceTabs supports horizontal overflow", workspaceTabs.includes("overflow-x-auto"));
  check("WorkspaceTabs avoids legacy primary neon", !workspaceTabs.includes("purple-500") && !workspaceTabs.includes("cyan-400"));
}

console.log(`\n${failures === 0 ? "ALL EXPERIENCE 4.0 CHECKS PASSED" : `${failures} EXPERIENCE 4.0 CHECK(S) FAILED`}`);
if (failures > 0) process.exit(1);
