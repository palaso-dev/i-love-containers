export type ContainerState =
  "running" | "stopped" | "restarting" | "created" | "paused" | "exited";

export interface PortMapping {
  ip?: string;
  privatePort: number;
  publicPort?: number;
  type: string;
}

export interface MountMapping {
  type: string;
  source: string;
  destination: string;
  mode?: string;
  rw?: boolean;
}

export interface ContainerSummary {
  id: string;
  name: string;
  image: string;
  imageId: string;
  state: ContainerState;
  status: string;
  created: string;
  startedAt?: string;
  ports: PortMapping[];
  composeProject?: string;
  composeService?: string;
  cpuPercent?: number;
  memoryUsage?: number;
  memoryLimit?: number;
}

export interface ContainerDetail extends ContainerSummary {
  command?: string;
  env: string[];
  mounts: MountMapping[];
  networks: string[];
  ipAddress?: string;
  restartPolicy?: string;
  platform?: string;
  rawInspectJson?: string;
}

export interface ContainerFileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink: boolean;
  linkTarget?: string;
  size: number;
  mtime: string;
  permissions: string;
  owner?: string;
  group?: string;
}

export interface ContainerFileListResponse {
  currentPath: string;
  parentPath: string | null;
  entries: ContainerFileItem[];
  defaultWorkingDir?: string;
}

export interface ContainerStats {
  containerId: string;
  timestamp: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  blockReadBytes: number;
  blockWriteBytes: number;
  pidsCount: number;
}

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: number;
  created: string;
  inUse: boolean;
  containerCount?: number;
}

export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt?: string;
  size?: number;
  inUse: boolean;
  containers: string[];
}

export interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  containers: {
    id: string;
    name: string;
    ipv4: string;
  }[];
}

export interface ComposeProject {
  name: string;
  workingDir?: string;
  configFile?: string;
  yamlContent?: string;
  containers: ContainerSummary[];
  status?: "running" | "stopped" | "down";
}

export type EngineType =
  "docker-desktop" | "orbstack" | "rancher" | "colima" | "podman" | "custom";

export type EngineStatus = "running" | "stopped" | "not_installed";

export interface ContainerEngineInfo {
  id: EngineType | string;
  name: string;
  type: EngineType;
  socketPath: string;
  appPath?: string;
  status: EngineStatus;
  isDefault?: boolean;
  isActive?: boolean;
  version?: string;
  apiVersion?: string;
  arch?: string;
  os?: string;
  description?: string;
  icon?: string;
}

export interface SystemOverview {
  dockerConnected: boolean;
  engineVersion: string;
  operatingSystem: string;
  architecture: string;
  totalContainers: number;
  runningContainers: number;
  stoppedContainers: number;
  pausedContainers: number;
  totalImages: number;
  totalVolumes: number;
  totalNetworks: number;
  systemCpuPercent: number;
  systemMemoryTotal: number;
  systemMemoryUsed: number;
  hostName: string;
  activeHost: string;
  isMockData?: boolean;
  activeEngine?: ContainerEngineInfo;
  detectedEngines?: ContainerEngineInfo[];
}

export type ActiveTab =
  | "overview"
  | "containers"
  | "images"
  | "volumes"
  | "networks"
  | "compose"
  | "settings";

export type ContainerDetailTab =
  | "overview"
  | "logs"
  | "terminal"
  | "stats"
  | "inspect"
  | "files";

export const CONTAINER_DETAIL_TABS: ContainerDetailTab[] = [
  "overview",
  "logs",
  "terminal",
  "stats",
  "inspect",
  "files",
];

export type Language = "en" | "es";

export type AppTheme =
  | "liquid-glass"
  | "retro-console"
  | "neo-brutalist"
  | "material-flow"
  | "pixel-arcade";

export type AccentColor =
  "blue" | "sky" | "mint" | "orange" | "pink" | "purple" | "graphite";

export type ColorMode = "light" | "dark" | "system";

export type LayerFileChangeType = "added" | "modified" | "deleted";

export interface ImageLayerFileItem {
  path: string;
  size: number;
  type: "file" | "dir" | "symlink";
  changeType: LayerFileChangeType;
}

export interface ImageLayerDetail {
  id: string;
  index: number;
  command: string;
  rawCommand: string;
  instructionType: string;
  size: number;
  sizePercent: number;
  created: string;
  emptyLayer: boolean;
  isBloat?: boolean;
  bloatReason?: string;
  files?: ImageLayerFileItem[];
}

export interface ImageOptimizationAdvice {
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  layerIndex?: number;
  potentialSavings?: number;
}

export interface ImageAnalysis {
  imageId: string;
  repository: string;
  tag: string;
  totalSize: number;
  wastedSize: number;
  efficiencyScore: number;
  layerCount: number;
  architecture?: string;
  os?: string;
  author?: string;
  layers: ImageLayerDetail[];
  recommendations: ImageOptimizationAdvice[];
}

export interface NavigationEntry {
  activeTab: ActiveTab;
  selectedContainerId: string | null;
  containerDetailTab:
    "overview" | "logs" | "terminal" | "stats" | "inspect" | "files";
  selectedImageId: string | null;
}

export interface SystemDiskUsage {
  imagesSize: number;
  imagesReclaimable: number;
  imagesCount: number;
  containersSize: number;
  containersReclaimable: number;
  containersCount: number;
  volumesSize: number;
  volumesReclaimable: number;
  volumesCount: number;
  buildCacheSize: number;
  buildCacheReclaimable: number;
  totalSize: number;
  totalReclaimable: number;
}

export interface PruneOptions {
  containers?: boolean;
  containerIds?: string[];
  images?: boolean;
  imageIds?: string[];
  allImages?: boolean;
  volumes?: boolean;
  volumeNames?: string[];
  buildCache?: boolean;
}


export interface PruneResult {
  ok: boolean;
  spaceReclaimed: number;
  containersDeleted?: number;
  imagesDeleted?: number;
  volumesDeleted?: number;
  buildCacheDeleted?: number;
}

