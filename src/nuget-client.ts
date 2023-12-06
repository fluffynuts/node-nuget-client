import { Readable } from "stream";
import * as path from "path";
import bent from "bent";
import * as unzipper from "unzipper";
import {
  PackageIndex,
  DownloadOptions,
  LogFunction,
  PackageIdentifier,
  PackageInfo,
  QueryResponse
} from "./interfaces";
import {
  folderExists,
  mkdir, rm, writeFile
} from "yafs";

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

export class NugetClient {
  private readonly registryUrl: string;
  private readonly _loggers: LogFunction[] = [];

  constructor(registryUrl?: string) {
    this.registryUrl = registryUrl || defaultRegistryUrl;
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
        const zip = await unzipper.Open.buffer(packageBuffer as Buffer);
        for (const file of zip.files) {
          const
            buffer = await file.buffer(),
            target = path.join(outDir, file.path);
          await writeFile(target, buffer);
        }
        return resolve();
      } catch (e) {
        return reject(e);
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

