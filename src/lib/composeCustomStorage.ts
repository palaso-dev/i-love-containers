export interface CustomComposeConfig {
  command: string;
  useAsDefault: boolean;
}

export interface SavedStackProject {
  id: string;
  name: string;
  workingDir: string;
  configFile?: string;
  command: string;
  useAsDefault?: boolean;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_PREFIX = "ilc_compose_custom_";
const SAVED_STACKS_KEY = "ilc_saved_stacks_v1";
const PROJECT_ALIASES_KEY = "ilc_compose_project_aliases_v1";

export function getCustomComposeConfig(
  projectName: string,
): CustomComposeConfig {
  try {
    const raw = localStorage.getItem(
      `${STORAGE_PREFIX}${projectName.toLowerCase()}`,
    );
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        command: typeof parsed.command === "string" ? parsed.command : "",
        useAsDefault: Boolean(parsed.useAsDefault),
      };
    }
  } catch {}
  return { command: "", useAsDefault: false };
}

export function saveCustomComposeConfig(
  projectName: string,
  config: CustomComposeConfig,
): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${projectName.toLowerCase()}`,
      JSON.stringify(config),
    );
  } catch {}
}

export function getSavedStackProjects(): SavedStackProject[] {
  try {
    const raw = localStorage.getItem(SAVED_STACKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}
  return [];
}

export function saveStackProject(stack: Omit<SavedStackProject, "id" | "createdAt" | "updatedAt"> & { id?: string }): SavedStackProject {
  const stacks = getSavedStackProjects();
  const now = Date.now();

  if (stack.id) {
    const index = stacks.findIndex((s) => s.id === stack.id);
    if (index >= 0) {
      const updated: SavedStackProject = {
        ...stacks[index],
        ...stack,
        id: stack.id,
        updatedAt: now,
      };
      stacks[index] = updated;
      localStorage.setItem(SAVED_STACKS_KEY, JSON.stringify(stacks));
      return updated;
    }
  }

  const newStack: SavedStackProject = {
    ...stack,
    id: stack.id || `stack-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };
  stacks.unshift(newStack);
  try {
    localStorage.setItem(SAVED_STACKS_KEY, JSON.stringify(stacks));
  } catch {}
  return newStack;
}

export function deleteSavedStackProject(id: string): void {
  try {
    const stacks = getSavedStackProjects().filter((s) => s.id !== id);
    localStorage.setItem(SAVED_STACKS_KEY, JSON.stringify(stacks));
  } catch {}
}

export function getProjectAliases(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PROJECT_ALIASES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch {}
  return {};
}

export function setProjectAlias(originalName: string, aliasName: string): void {
  try {
    const aliases = getProjectAliases();
    if (aliasName.trim() && aliasName.trim() !== originalName) {
      aliases[originalName.toLowerCase()] = aliasName.trim();
    } else {
      delete aliases[originalName.toLowerCase()];
    }
    localStorage.setItem(PROJECT_ALIASES_KEY, JSON.stringify(aliases));
  } catch {}
}

export function getProjectDisplayName(originalName: string): string {
  const aliases = getProjectAliases();
  return aliases[originalName.toLowerCase()] || originalName;
}

const HIDDEN_PROJECTS_KEY = "ilc_compose_hidden_projects_v1";

export function getHiddenComposeProjects(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).toLowerCase());
      }
    }
  } catch {}
  return [];
}

export function hideComposeProject(projectName: string): void {
  try {
    const hidden = getHiddenComposeProjects();
    const clean = projectName.trim().toLowerCase();
    if (clean && !hidden.includes(clean)) {
      hidden.push(clean);
      localStorage.setItem(HIDDEN_PROJECTS_KEY, JSON.stringify(hidden));
    }
  } catch {}
}

export function unhideComposeProject(projectName: string): void {
  try {
    const hidden = getHiddenComposeProjects();
    const clean = projectName.trim().toLowerCase();
    const filtered = hidden.filter((h) => h !== clean);
    localStorage.setItem(HIDDEN_PROJECTS_KEY, JSON.stringify(filtered));
  } catch {}
}

