// Files: which icon a row gets. The icons are Material Icon Theme's (MIT, icons/LICENSE),
// full color, drawn with image(); only the ones named here are kept in icons/.
const EXT = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "react",
  ts: "typescript", mts: "typescript", cts: "typescript", tsx: "react_ts",
  go: "go", json: "json", jsonc: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  md: "markdown", html: "html", htm: "html", css: "css", scss: "sass", sass: "sass",
  py: "python", rs: "rust", java: "java", c: "c", h: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp",
  cs: "csharp", php: "php", rb: "ruby", lua: "lua", kt: "kotlin", swift: "swift", dart: "dart",
  vue: "vue", svelte: "svelte", xml: "xml",
  sh: "console", bash: "console", zsh: "console", bat: "console", cmd: "console", ps1: "powershell", psm1: "powershell",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", ico: "image", bmp: "image", svg: "svg", pdf: "pdf",
  zip: "zip", tar: "zip", gz: "zip", tgz: "zip", "7z": "zip", rar: "zip",
  db: "database", sqlite: "database", sql: "database", csv: "table", tsv: "table",
  lock: "lock", log: "log", exe: "exe", dll: "exe", ini: "settings", cfg: "settings", conf: "settings", txt: "document",
};
const NAME = {
  "package.json": "nodejs", "package-lock.json": "npm", "yarn.lock": "yarn", "pnpm-lock.yaml": "pnpm",
  dockerfile: "docker", "docker-compose.yml": "docker", "docker-compose.yaml": "docker",
  ".gitignore": "git", ".gitattributes": "git", ".gitmodules": "git", "go.mod": "go-mod", "go.sum": "go-mod",
  readme: "readme", "readme.md": "readme", license: "certificate", "license.md": "certificate", "license.txt": "certificate",
};
const FOLDER = {
  src: "folder-src", node_modules: "folder-node", test: "folder-test", tests: "folder-test", __tests__: "folder-test",
  docs: "folder-docs", doc: "folder-docs", images: "folder-images", img: "folder-images", config: "folder-config",
  scripts: "folder-scripts", dist: "folder-dist", build: "folder-dist", out: "folder-dist", ".github": "folder-github", ".vscode": "folder-vscode",
};

// Every icon file used, for the test (each must exist in icons/).
export const ICONS = [...new Set([...Object.values(EXT), ...Object.values(NAME), "typescript-def", "tune", "file",
  ...[...Object.values(FOLDER), "folder"].flatMap((f) => [f, `${f}-open`])])];

export function iconFor(name, dir, open) {
  const n = name.toLowerCase();
  if (dir) return `mods/my-files/icons/${FOLDER[n] ?? "folder"}${open ? "-open" : ""}.svg`;
  const ext = n.slice(n.lastIndexOf(".") + 1);
  const icon = NAME[n] || (n.endsWith(".d.ts") && "typescript-def") || (n.startsWith(".env") && "tune") || (n.includes(".") && EXT[ext]) || "file";
  return `mods/my-files/icons/${icon}.svg`;
}
