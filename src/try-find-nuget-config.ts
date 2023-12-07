import os from "os";
import { folderExistsSync, FsEntities, lsSync, readTextFileSync } from "yafs";
import path from "path";
import { parseXml } from "./xml-to-json";

// NOTE: functions in here have to be synchronous as
// they are ultimated called from a constructor :|

export interface NugetConfig {
  configuration: NugetConfigConfiguration;
}

export interface NugetConfigConfiguration {
  packageSources: {
    add: PackageSource | PackageSource[]
  }
  // TODO: do we need the rest? credentials? perhaps
  //        later, when there's a need to read from
  //        protected nuget sources; rn i just need
  //        nuget.org and the point of the nuget config
  //        code is to map 'nuget.org' to an url
}

export interface PackageSource {
  key: string;
  value: string;
  protocolVersion: string;
}

let cachedNugetConfigPath: string;

export function tryFindNugetConfig(): string | undefined {
  if (cachedNugetConfigPath) {
    return cachedNugetConfigPath;
  }
  // attempt to find nuget.config via path searches as per
  // https://learn.microsoft.com/en-us/nuget/consume-packages/configuring-nuget-behavior#additional-user-wide-configuration
  switch (os.platform()) {
    case "win32":
      return cacheNugetConfigPath(tryFindNugetConfigWin32());
    default:
      return cacheNugetConfigPath(tryFindNugetConfigNix());
  }
}

function cacheNugetConfigPath(str: string | undefined): string | undefined {
  if (str) {
    cachedNugetConfigPath = str;
  }
  return str;
}

function tryFindNugetConfigNix(): string | undefined {
  const
    home = process.env.HOME;
  if (!home || !folderExistsSync(home)) {
    return undefined;
  }
  const search = [
    path.join(home, ".config", "NuGet", "config"),
    path.join(home, ".nuget", "config"),
  ];
  return findFirstNugetConfig(search);
}

function tryFindNugetConfigWin32(): string | undefined {
  const
    appdata = process.env.APPDATA;
  if (!appdata || !folderExistsSync(appdata)) {
    return undefined;
  }

  const search = [
    path.join(appdata, "NuGet", "config"),
    path.join(appdata, "NuGet") // I've seen this observed on my machine...
  ]
  return findFirstNugetConfig(search);
}

function findFirstNugetConfig(search: string[]): string | undefined {
  for (const folder of search) {
    const contents = lsSync(folder, {
      recurse: false,
      entities: FsEntities.files,
      fullPaths: true,
      match: /nuget.config/i
    });
    if (contents.length) {
      return contents[0];
    }
  }
}

export function tryReadNugetConfig(
  at?: string
): NugetConfig | undefined {
  const configPath = at ?? tryFindNugetConfig();
  if (!configPath) {
    return undefined;
  }
  try {
    const
      contents = readTextFileSync(configPath),
      // convert = require("xmltojson"),
      // { toJson } = require("xml2json"),
      result = parseXml<NugetConfig>(contents);
    if (!result || !result.configuration || !result.configuration.packageSources || !result.configuration.packageSources) {
      console.warn(`WARN: invalid configuration at '${ configPath }':\n${ JSON.stringify(result, null, 2) }`);
    }
    return result;
  } catch (e) {
    console.warn(`WARN: unable to parse nuget config at '${ configPath }':\n${ e }`);
    return undefined;
  }

}
