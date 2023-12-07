#!/usr/bin/env node
import yargs from "yargs";
import chalk from "chalk";
import { NugetClient } from "./nuget-client";
import { QueryResponse, QueryResponseDataItem } from "./interfaces";

interface InstallOptions {
  packageId: string;
  version?: string;
  output: string
}

interface SearchOptions {
  word: string;
  words?: string[]
}

interface InfoOptions {
  packageId: string;
}

function die(error: Error | string) {
  const message = typeof error === "string"
    ? error
    : error.message;
  console.error(chalk.red(message));
  process.exit(1);
}

function printInfo(d: QueryResponseDataItem) {
  // console.log(d);
  console.log(`${ d.id }
    version:   ${ d.version }
    downloads: ${ d.totalDownloads }
    tags:      ${ (d.tags || []).join(",") }
    url:       ${ d.projectUrl }
    
    ${ d.title }
    -----
    ${ formatSummary(d.description, 4) }
`);
}

function formatSummary(text: string, indent: number) {
  const lines = text.replace(/\r/g, "")
    .replace(/<br\/>/g, "")
    .replace(/<br>/g, "")
    .split("\n");
  const
    spaces = makeSpaces(indent),
    pre = `\n${ spaces }`;
  return pre + lines.map(l => l.trim()).join(pre);
}

function makeSpaces(howMany: number): string {
  return new Array(howMany + 1).join(" ");
}

function makeClient() {
  const result = new NugetClient();
  result.addLogger(console.log.bind(console));
  return result;
}

type AsyncAction<T> = (arg: T) => Promise<void>;

async function run(fn: AsyncAction<NugetClient>) {
  try {
    await fn(makeClient());
  } catch (e) {
    die(e as Error);
  }
}

function printQueryResults(
  query: string,
  result: QueryResponse
) {
  if ((result.data || []).length === 0) {
    console.log(chalk.red(`No results for ${ query }`));
  } else {
    result.data.forEach((d, idx) => {
      if (idx) {
        console.log("");
      }
      printInfo(d);
    })
  }
}

const _ = yargs.command(
  "download <packageId>",
  "Downloads a nuget package an unpacks it (almost like 'nuget.exe install', except there's currently no support for updating projects)",
  y => {
    y.positional("packageId", {
      describe: "package id, with optional version, ie Foo.Bar or Foo.Bar.1.2.3",
    }).option("output", {
      alias: "o",
      description: "base folder for output: packages will have their own container folders",
      default: process.cwd()
    })
  },
  async (args: InstallOptions) => {
    await run(async (client) => {
      const result = await client.downloadPackage(args);
      if (!result) {
        const fullName = args.version
          ? `${ args.packageId }.${ args.version }`
          : args.packageId;
        console.log(`package not found: ${ fullName }`);
      } else {
        console.log(`${ result.fullName } downloaded to ${ result.fullPath }`);
      }
    });
  }
).command(
  "search <word> [words...]",
  "Searches for packages by any words",
  y => {
    y.positional("query", {
      describe: "package id or partial package id to search for",
    })
  }, async (args: SearchOptions) => {
    await run(async (client) => {
      const allwords = [ args.word ].concat(args.words || []).join(" ");
      const result = await client.search(allwords);
      printQueryResults(allwords, result);
    });
  }
).command(
  "info <packageId>",
  "Finds package info for the provided package id",
  y => {
    y.positional("packageId", {
      describe: "package id to search for"
    })
  },
  async (args: InfoOptions) => {
    await run(async (client) => {
      const result = await client.fetchPackageInfo(args.packageId);
      printQueryResults(args.packageId, result);
    });
  }
).argv;

