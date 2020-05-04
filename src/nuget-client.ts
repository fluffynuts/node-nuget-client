const
    bent = require("bent"),
    httpGet = bent("json"),
    defaultRegistryUrl = "https://api.nuget.org/v3/index.json";

export interface NugetResource {
    _id: string;
    _type: string;
    comment: string;
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

export interface QueryResponseContent {
    vocab: string;
    base: string;
}

export interface QueryResponse {
    content: QueryResponseContent;
    totalHits: number;
    data: QueryResponseDataItem[];
}

export interface QueryResponseDataItem {
    _id: string;
    _type: "Package"; // looks like it's always this, even when doing a search by author name
    registration: string;
    id: string;
    version: string;
    description: string;
    summary: string;
    title: string;
    iconUrl: string;
    licenseUrl: string;
    projectUrl: string;
    tags: string[];
    authors: string[];
    totalDownloads: number;
    verified: boolean;
    packageTypes: { name: string }[],
    versions: QueryResponseVersion[];
}

export interface QueryResponseVersion {
    version: string;
    downloads: number;
    _id: string; // this is an url to the json index for this package
}

export interface PackageInfo {
    id: string;
    version: string;
    currentVersion: string;
    indexUrl: string;
    downloads: number;
    totalDownloads: number;
    description: string;
    summary: string;
    title: string;
    iconUrl: string;
    licenseUrl: string;
    projectUrl: string;
    tags: string[];
    authors: string[];
    verified: boolean;
}

interface ResourceCache {
    [key: string]: ResourceCacheItem;
}

interface ResourceCacheItem {
    primarySearchUrl: string;
    secondarySearchUrl: string | null;
}

const cache: ResourceCache = {
};

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

    constructor(registryUrl?: string) {
        this.registryUrl = registryUrl || defaultRegistryUrl;
    }

    public async fetchPackageInfo(packageId: string) {
        return await this.query(`packageId:${packageId}`);
    }

    public async fetchResources(): Promise<NugetResources> {
        return await fetchResources(this.registryUrl);
    }

    public async query(query: string): Promise<QueryResponse> {
        const cache = await cacheApiResourcesFor(this.registryUrl);
        return mapAtFields(
            await httpGet(
                `${ cache.primarySearchUrl }?q=${ encodeURIComponent(query) }`
            )
        ) as QueryResponse
    }

    public async findPackage(
        packageId: string,
        version?: string): Promise<PackageInfo | undefined> {
        const
            packageInfo = await this.fetchPackageInfo(packageId),
            data = packageInfo.data[0];
        if (!data) {
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
