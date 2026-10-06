import { parseDocument, Document, isMap, isSeq, YAMLMap } from "yaml";

type YamlObject = { [key: string]: unknown };

function scalarValue(node: unknown): unknown {
  if (node === null || node === undefined) return undefined;
  if (
    typeof node === "object" &&
    "valueOf" in node &&
    typeof (node as { valueOf?: unknown }).valueOf === "function"
  ) {
    return (node as { valueOf: () => unknown }).valueOf();
  }
  return node;
}

function scalarKey(node: unknown): string {
  const value = scalarValue(node);
  return value == null ? "" : String(value);
}

function asYamlMap(node: unknown): YAMLMap {
  return isMap(node) ? node : new YAMLMap();
}

export interface ComposeServiceConfig {
  name: string;
  image?: string;
  container_name?: string;
  restart?: "no" | "always" | "on-failure" | "unless-stopped" | string;
  platform?: string;
  ports?: string[];
  environment?: string[];
  depends_on?: string[];
  networks?: string[];
  volumes?: string[];
  command?: string;

  customDirectives?: Array<{ key: string; value: string }>;

  extraLines?: string[];
}

export interface ParsedComposeFile {
  version?: string;
  services: ComposeServiceConfig[];
  availableNetworks: string[];
  availableVolumes: string[];
  rawTopLevelNetworks?: string;
  rawTopLevelVolumes?: string;
  rawHeaderComments?: string;
  _rawDoc?: Document;
}

export function parseComposeYamlToConfig(
  yamlString: string,
): ParsedComposeFile {
  let doc: Document;
  try {
    doc = parseDocument(yamlString);
  } catch {
    doc = new Document({ version: "3.8", services: {} });
  }

  const versionNode = doc.get("version");
  const version =
    typeof versionNode === "string" || typeof versionNode === "number"
      ? String(versionNode)
      : "3.8";

  const availableNetworks: string[] = [];
  const networksNode = doc.get("networks");
  if (isMap(networksNode)) {
    for (const item of networksNode.items) {
      if (item.key != null) {
        const k = scalarKey(item.key);
        if (k && !availableNetworks.includes(k)) availableNetworks.push(k);
      }
    }
  }

  const availableVolumes: string[] = [];
  const volumesNode = doc.get("volumes");
  if (isMap(volumesNode)) {
    for (const item of volumesNode.items) {
      if (item.key != null) {
        const k = scalarKey(item.key);
        if (k && !availableVolumes.includes(k)) availableVolumes.push(k);
      }
    }
  }

  const services: ComposeServiceConfig[] = [];
  const servicesNode = doc.get("services");

  if (isMap(servicesNode)) {
    for (const pair of servicesNode.items) {
      const serviceName = scalarKey(pair.key);
      if (!serviceName) continue;

      const svcVal = pair.value;
      if (!isMap(svcVal)) {
        services.push({
          name: serviceName,
          ports: [],
          environment: [],
          depends_on: [],
          networks: [],
          volumes: [],
          customDirectives: [],
        });
        continue;
      }

      const image = svcVal.get("image");
      const containerName = svcVal.get("container_name");
      const restart = svcVal.get("restart");
      const platform = svcVal.get("platform");
      const command = svcVal.get("command");

      const ports: string[] = [];
      const portsNode = svcVal.get("ports");
      if (isSeq(portsNode)) {
        for (const p of portsNode.items) {
          const val = scalarValue(p);
          if (typeof val === "string" || typeof val === "number") {
            ports.push(String(val));
          } else if (val && typeof val === "object") {
            const target = (val as YamlObject).target;
            const published = (val as YamlObject).published;
            if (target && published) {
              ports.push(`${published}:${target}`);
            } else if (target) {
              ports.push(String(target));
            }
          }
        }
      }

      const environment: string[] = [];
      const envNode = svcVal.get("environment");
      if (isSeq(envNode)) {
        for (const e of envNode.items) {
          const val = scalarValue(e);
          if (val != null) environment.push(String(val));
        }
      } else if (isMap(envNode)) {
        for (const envPair of envNode.items) {
          const k = scalarKey(envPair.key);
          const v = scalarValue(envPair.value);
          if (k) {
            environment.push(`${k}=${v != null ? String(v) : ""}`);
          }
        }
      }

      const dependsOn: string[] = [];
      const depNode = svcVal.get("depends_on");
      if (isSeq(depNode)) {
        for (const d of depNode.items) {
          const val = scalarValue(d);
          if (val != null) dependsOn.push(String(val));
        }
      } else if (isMap(depNode)) {
        for (const depPair of depNode.items) {
          const k = scalarKey(depPair.key);
          if (k) dependsOn.push(k);
        }
      }

      const networks: string[] = [];
      const netNode = svcVal.get("networks");
      if (isSeq(netNode)) {
        for (const n of netNode.items) {
          const val = scalarValue(n);
          if (val != null) networks.push(String(val));
        }
      } else if (isMap(netNode)) {
        for (const netPair of netNode.items) {
          const k = scalarKey(netPair.key);
          if (k) networks.push(k);
        }
      }

      const volumes: string[] = [];
      const volNode = svcVal.get("volumes");
      if (isSeq(volNode)) {
        for (const v of volNode.items) {
          const val = scalarValue(v);
          if (typeof val === "string") {
            volumes.push(val);
          } else if (val && typeof val === "object") {
            const source = (val as YamlObject).source;
            const target = (val as YamlObject).target;
            if (source && target) {
              volumes.push(`${source}:${target}`);
            }
          }
        }
      }

      const customDirectives: Array<{ key: string; value: string }> = [];
      const knownKeys = new Set([
        "image",
        "container_name",
        "restart",
        "platform",
        "command",
        "ports",
        "environment",
        "depends_on",
        "networks",
        "volumes",
      ]);

      for (const p of svcVal.items) {
        const k = scalarKey(p.key);
        if (knownKeys.has(k)) continue;
        const v = scalarValue(p.value);
        if (
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean"
        ) {
          customDirectives.push({ key: k, value: String(v) });
        }
      }

      services.push({
        name: serviceName,
        image: image != null ? String(scalarValue(image)) : undefined,
        container_name:
          containerName != null
            ? String(scalarValue(containerName))
            : undefined,
        restart:
          restart != null ? String(scalarValue(restart)) : undefined,
        platform:
          platform != null ? String(scalarValue(platform)) : undefined,
        command:
          command != null
            ? Array.isArray(scalarValue(command))
              ? (scalarValue(command) as unknown[]).join(" ")
              : String(scalarValue(command))
            : undefined,
        ports,
        environment,
        depends_on: dependsOn,
        networks,
        volumes,
        customDirectives,
      });
    }
  }

  return {
    version,
    services,
    availableNetworks,
    availableVolumes,
    _rawDoc: doc,
  };
}

export function serializeConfigToComposeYaml(
  config: ParsedComposeFile,
): string {
  const doc: Document = config._rawDoc
    ? config._rawDoc.clone()
    : new Document();

  if (!config._rawDoc) {
    if (config.version) {
      doc.set("version", config.version);
    }
    doc.set("services", new YAMLMap());
  }

  let servicesNode = doc.get("services");
  if (!isMap(servicesNode)) {
    servicesNode = new YAMLMap();
    doc.set("services", servicesNode);
  }
  const servicesMap = asYamlMap(servicesNode);

  const existingServiceKeys = new Set<string>();
  for (const item of servicesMap.items) {
    const k = scalarKey(item.key);
    if (k) existingServiceKeys.add(k);
  }

  const desiredServiceNames = new Set(config.services.map((s) => s.name));

  for (const existingKey of existingServiceKeys) {
    if (!desiredServiceNames.has(existingKey)) {
      servicesMap.delete(existingKey);
    }
  }

  for (const svc of config.services) {
    let svcNode = servicesMap.get(svc.name);
    if (!isMap(svcNode)) {
      svcNode = new YAMLMap();
      servicesMap.set(svc.name, svcNode);
    }
    const svcMap = asYamlMap(svcNode);

    if (svc.image) svcMap.set("image", svc.image);
    else svcMap.delete("image");

    if (svc.container_name) svcMap.set("container_name", svc.container_name);
    else svcMap.delete("container_name");

    if (svc.restart) svcMap.set("restart", svc.restart);
    else svcMap.delete("restart");

    if (svc.platform) svcMap.set("platform", svc.platform);
    else svcMap.delete("platform");

    if (svc.command) svcMap.set("command", svc.command);
    else svcMap.delete("command");

    if (svc.ports && svc.ports.length > 0) {
      svcMap.set("ports", svc.ports);
    } else {
      svcMap.delete("ports");
    }

    if (svc.environment && svc.environment.length > 0) {
      svcMap.set("environment", svc.environment);
    } else {
      svcMap.delete("environment");
    }

    if (svc.depends_on && svc.depends_on.length > 0) {
      const existingDepNode = svcMap.get("depends_on");
      if (isMap(existingDepNode)) {
        const existingDepKeys = new Set<string>();
        for (const depItem of existingDepNode.items) {
          const depK = scalarKey(depItem.key);
          if (depK) existingDepKeys.add(depK);
        }

        for (const depK of existingDepKeys) {
          if (!svc.depends_on.includes(depK)) {
            existingDepNode.delete(depK);
          }
        }

        for (const dep of svc.depends_on) {
          if (!existingDepKeys.has(dep)) {
            existingDepNode.set(dep, { condition: "service_started" });
          }
        }
      } else {
        svcMap.set("depends_on", svc.depends_on);
      }
    } else {
      svcMap.delete("depends_on");
    }

    if (svc.networks && svc.networks.length > 0) {
      svcMap.set("networks", svc.networks);
    } else {
      svcMap.delete("networks");
    }

    if (svc.volumes && svc.volumes.length > 0) {
      svcMap.set("volumes", svc.volumes);
    } else {
      svcMap.delete("volumes");
    }

    if (svc.customDirectives && svc.customDirectives.length > 0) {
      for (const d of svc.customDirectives) {
        if (d.key && d.key.trim()) {
          svcMap.set(d.key.trim(), d.value.trim());
        }
      }
    }
  }

  if (config.availableNetworks && config.availableNetworks.length > 0) {
    let networksNode = doc.get("networks");
    if (!isMap(networksNode)) {
      networksNode = new YAMLMap();
      doc.set("networks", networksNode);
    }
    const networksMap = asYamlMap(networksNode);
    for (const net of config.availableNetworks) {
      if (!networksMap.has(net)) {
        const netDef = new YAMLMap();
        netDef.set("driver", "bridge");
        networksMap.set(net, netDef);
      }
    }
  }

  if (config.availableVolumes && config.availableVolumes.length > 0) {
    let volumesNode = doc.get("volumes");
    if (!isMap(volumesNode)) {
      volumesNode = new YAMLMap();
      doc.set("volumes", volumesNode);
    }
    const volumesMap = asYamlMap(volumesNode);
    for (const vol of config.availableVolumes) {
      if (!volumesMap.has(vol)) {
        const volDef = new YAMLMap();
        volDef.set("driver", "local");
        volumesMap.set(vol, volDef);
      }
    }
  }

  return doc.toString();
}

export function applyBulkServiceConfig(
  yamlString: string,
  targetServices: string[],
  action: {
    field: "platform" | "restart" | "environment" | "network" | "custom";
    value: string;
    customKey?: string;
  },
): string {
  const doc = parseDocument(yamlString);
  const servicesNode = doc.get("services");
  if (!isMap(servicesNode)) {
    return yamlString;
  }

  const allServiceNames: string[] = [];
  for (const pair of servicesNode.items) {
    const k = scalarKey(pair.key);
    if (k) allServiceNames.push(k);
  }

  const targets = new Set(
    targetServices.length > 0 ? targetServices : allServiceNames,
  );

  for (const svcName of targets) {
    const svcNode = servicesNode.get(svcName);
    if (!isMap(svcNode)) continue;
    const svcMap = asYamlMap(svcNode);

    switch (action.field) {
      case "platform":
        if (action.value.trim() === "") {
          svcMap.delete("platform");
        } else {
          svcMap.set("platform", action.value.trim());
        }
        break;

      case "restart":
        if (action.value.trim() === "") {
          svcMap.delete("restart");
        } else {
          svcMap.set("restart", action.value.trim());
        }
        break;

      case "environment": {
        const envItem = action.value.trim();
        if (envItem) {
          const [varName] = envItem.split("=");
          const envNode = svcMap.get("environment");
          if (isSeq(envNode)) {
            const idx = envNode.items.findIndex((item: unknown) =>
              scalarKey(scalarValue(item)).startsWith(`${varName}=`),
            );
            if (idx >= 0) {
              envNode.items[idx] = envItem;
            } else {
              envNode.add(envItem);
            }
          } else if (isMap(envNode)) {
            const [, val] = envItem.split("=");
            envNode.set(varName, val || "");
          } else {
            svcMap.set("environment", [envItem]);
          }
        }
        break;
      }

      case "network": {
        const netName = action.value.trim();
        if (netName) {
          const netNode = svcMap.get("networks");
          if (isSeq(netNode)) {
            const exists = netNode.items.some(
              (item: unknown) => scalarKey(scalarValue(item)) === netName,
            );
            if (!exists) {
              netNode.add(netName);
            }
          } else {
            svcMap.set("networks", [netName]);
          }

          let topNetworks = doc.get("networks");
          if (!isMap(topNetworks)) {
            topNetworks = new YAMLMap();
            doc.set("networks", topNetworks);
          }
          const topNetworksMap = asYamlMap(topNetworks);
          if (!topNetworksMap.has(netName)) {
            const def = new YAMLMap();
            def.set("driver", "bridge");
            topNetworksMap.set(netName, def);
          }
        }
        break;
      }

      case "custom": {
        if (action.customKey) {
          const k = action.customKey.trim();
          const v = action.value.trim();
          svcMap.set(k, v);
        }
        break;
      }
    }
  }

  return doc.toString();
}
