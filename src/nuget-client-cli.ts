#!/usr/bin/env node
import yargs from "yargs";
import { NugetClient } from "./nuget-client";

interface InstallOptions {
    packageId: string;
    version?: string;
    output: string
}

const _ = yargs.command("install [packageId]", "", y => {
    y.positional("packageId", {
        describe: "package id, with optional version, ie Foo.Bar or Foo.Bar.1.2.3",
        demandOption: true
    }).option("output", {
        alias: "o",
        description: "base folder for output: packages will have their own container folders",
        default: process.cwd()
    })
}, async (args: InstallOptions) => {
    const client = new NugetClient();
    client.addLogger(console.log.bind(console));
    try {
        await client.downloadPackage(args);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}).argv;

