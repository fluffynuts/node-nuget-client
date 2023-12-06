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

export type LogFunction = (message: string) => void;

export interface PackageIdentifier {
  packageId: string;
  version?: string;
}

export interface DownloadOptions
  extends PackageIdentifier {
  output: string;
}

export interface PackageIndex {
  id: string;
  type: string[];
  catalogEntry: string;
  listed: boolean;
  packageContent: string;
  published: string;
  registration: string;
  context: {
    vocab: string;
    xsd: string;
    catalogEntry: {
      type: string;
    }
    registration: {
      type: string;
    }
    packageContent: {
      type: string;
    }
    published: {
      type: string;
    }
  }
}
