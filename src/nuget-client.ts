import * as path from "path";
import bent from "bent";
import {
  DownloadOptions,
  LogFunction,
  PackageIdentifier,
  PackageIndex,
  PackageInfo,
  QueryResponse
} from "./interfaces";
import { folderExists, mkdir, rm, writeFile } from "yafs";
import { tryReadNugetConfig } from "./try-find-nuget-config";
import JSZip from "jszip";

const
  httpGet = bent("json"),
  httpGetBuffer = bent("buffer"),
  defaultRegistryUrl = "https://api.nuget.org/v3/index.json";

export interface NugetResource {
  _id: string;
  _type: string;
  comment: string;
}

export interface DownloadResult
  extends PackageInfo {
  fullName: string;
  fullPath: string;
}

export interface NugetResources {
  version: string;
  resources: NugetResource[];
}

interface Dictionary {
  [key: string]: any;
}

// nuget api has a bunch of fields with @ prefixes
function mapAtFields(obj: Dictionary): any {
  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(o => mapAtFields(o));
  }
  return Object.keys(obj)
    .reduce((acc, cur) => {
      const
        value = obj[cur] as Dictionary,
        mapped = typeof (value) === "object"
          ? mapAtFields(value)
          : value;
      if (cur.startsWith("@")) {
        acc["_" + cur.slice(1)] = mapped;
      } else {
        acc[cur] = mapped;
      }
      return acc;
    }, {} as Dictionary);
}

interface ResourceCache {
  [key: string]: ResourceCacheItem;
}

interface ResourceCacheItem {
  primarySearchUrl: string;
  secondarySearchUrl: string | null;
}

const cache: ResourceCache = {};

async function cacheApiResourcesFor(registryUrl: string): Promise<ResourceCacheItem> {
  if (cache[registryUrl]) {
    return cache[registryUrl];
  }
  const
    resources = await fetchResources(registryUrl),
    searchQueryServices = resources.resources.filter(r => r._type === "SearchQueryService");
  cache[registryUrl] = {
    primarySearchUrl: searchQueryServices[0]._id,
    secondarySearchUrl: searchQueryServices[1]
      ? searchQueryServices[1]._id
      : null
  };
  return cache[registryUrl];
}

async function fetchResources(registryUrl: string): Promise<NugetResources> {
  return mapAtFields(
    await httpGet(registryUrl)
  );
}

function tryResolveUrlFor(registryUrl?: string): string | undefined {
  if (!registryUrl) {
    return undefined;
  }
  const nugetConfig = tryReadNugetConfig();
  if (!nugetConfig) {
    // unable to resolve, assume valid url
    return registryUrl;
  }
  try {
    const
      sources = Array.isArray(nugetConfig.configuration.packageSources.add)
        ? nugetConfig.configuration.packageSources.add
        : [ nugetConfig.configuration.packageSources.add ];
    for (const source of sources) {
      if (source.key.toLowerCase() === registryUrl.toLowerCase()) {
        return source.value;
      }
    }
  } catch (e) {
    return undefined;
  }
}


export class NugetClient {
  private readonly registryUrl: string;
  private readonly _loggers: LogFunction[] = [];

  constructor(registryUrlOrName?: string) {
    registryUrlOrName = tryResolveUrlFor(registryUrlOrName);
    this.registryUrl = registryUrlOrName || defaultRegistryUrl;
  }

  public addLogger(fn: LogFunction): void {
    this._loggers.push(fn);
  }

  private log(message: string): void {
    this._loggers.forEach(l => {
      try {
        l(message);
      } catch (e) {
        console.error("logger error", e);
      }
    })
  }

  public fetchPackageInfo(packageId: string) {
    this.log(`fetching package info for: ${ packageId }`);
    return this.query(`packageId:${ packageId }`);
  }

  public search(query: string) {
    this.log(`searching for: ${ query }`);
    return this.query(query);
  }

  public async fetchResources(): Promise<NugetResources> {
    this.log(`fetching resources for registry: ${ this.registryUrl }`);
    return await fetchResources(this.registryUrl);
  }

  public async query(query: string): Promise<QueryResponse> {
    const cache = await cacheApiResourcesFor(this.registryUrl);
    this.log(`querying: ${ query }`);
    const queryUrl = `${ cache.primarySearchUrl }?q=${ encodeURIComponent(query) }`;
    return mapAtFields(
      await httpGet(queryUrl)
    ) as QueryResponse
  }

  public async downloadPackage(
    options: DownloadOptions
  ): Promise<DownloadResult | undefined> {
    const
      info = await this.findPackage(options);
    if (!info) {
      return;
    }
    if (!options.output) {
      options.output = process.cwd()
    }
    const
      { indexUrl } = info,
      index = mapAtFields(
        await httpGet(indexUrl)
      ) as PackageIndex,
      { packageContent } = index,
      fullName = `${ info.id }.${ info.version }`,
      outDir = path.join(options.output, fullName);
    if (await folderExists(outDir)) {
      // ensure a clean download
      await rm(outDir);
    }
    await mkdir(outDir);
    this.log(`download: ${ fullName }`)
    const
      packageBuffer = await httpGetBuffer(packageContent),
      nupkgTargetPath = path.join(outDir, `${ fullName }.nupkg`);

    await mkdir(outDir)
    await writeFile(
      nupkgTargetPath,
      packageBuffer as Buffer
    );
    return new Promise<DownloadResult>(async (_resolve, _reject) => {
      let completed = false;
      const resolve = () => {
        if (!completed) {
          completed = true;
          _resolve({
            ...info,
            fullName,
            fullPath: outDir
          });
        }
      };
      const reject = (e: Error) => {
        if (!completed) {
          completed = true;
          _reject(e);
        }
      };
      try {
        const
          zip = await JSZip.loadAsync(packageBuffer),
          filePaths = Object.keys(zip.files).sort();
        for (const filePath of filePaths) {
          const data = await zip.file(filePath)?.async("nodebuffer");
          if (!data) {
            console.warn(`zip file claims to have entry '${filePath}' but the file was not found within the archive`);
            // throw rather?
            continue;
          }
          const target = path.join(outDir, filePath);
          await writeFile(target, data);
        }
        return resolve();
      } catch (e) {
        return reject(e as Error);
      }
    });
  }

  private resolvePackageIdentifier(identifier: PackageIdentifier): PackageIdentifier {
    if (identifier.packageId && identifier.version) {
      return { ...identifier };
    }
    const parts = (identifier.packageId || "").split(".");
    if (parts.length < 4) {
      return { ...identifier };
    }
    const lastThree = parts.slice(parts.length - 3);
    const areAllNumeric = lastThree.reduce(
      (acc, cur) => acc && !isNaN(parseInt(cur)), true
    );
    return areAllNumeric
      ? {
        packageId: parts.slice(0, parts.length - 3).join("."),
        version: lastThree.join(".")
      }
      : { ...identifier }
  }

  public async findPackage(
    identifier: PackageIdentifier
  ): Promise<PackageInfo | undefined> {
    const resolved = this.resolvePackageIdentifier(identifier);
    let id = resolved.packageId;
    if (resolved.version) {
      id = `${ id }.${ resolved.version }`
    }
    this.log(`attempting to fetch package info for ${ id }`);
    const
      {
        packageId,
        version
      } = resolved,
      packageInfo = await this.fetchPackageInfo(packageId),
      data = packageInfo.data[0];
    if (!data) {
      this.log(`no package info found for ${ id }`);
      return undefined;
    }
    const versionData = !!version
      ? data.versions.find(info => info.version === version)
      : data.versions.find(info => info.version === data.version);
    if (!versionData) {
      return undefined;
    }
    return {
      id: data.id,
      currentVersion: data.version,
      version: versionData.version,
      description: data.description,
      summary: data.summary,
      title: data.title,
      iconUrl: data.iconUrl,
      licenseUrl: data.licenseUrl,
      projectUrl: data.projectUrl,
      tags: data.tags,
      authors: data.authors,
      totalDownloads: data.totalDownloads,
      downloads: versionData.downloads,
      verified: data.verified,
      indexUrl: versionData._id
    };
  }

}

