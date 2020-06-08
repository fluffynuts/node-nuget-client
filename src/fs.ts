import { promises, StatsBase } from "fs"
import _rimraf from "rimraf";

async function fileExists(p: string): Promise<boolean> {
    return runWithStat(p, st => st.isFile(), false);
}

function folderExists(p: string): Promise<boolean> {
    return runWithStat(p, st => st.isDirectory(), false);
}

async function runWithStat<T>(p: string, fn: ((st: StatsBase<any>) => T), defaultValue: T) {
    try {
        const st = await fs.stat(p);
        return st && fn(st);
    } catch (e) {
        return defaultValue;
    }
}

function rimraf(p: string): Promise<void> {
    return new Promise((resolve, reject) => {
        _rimraf(p, (err: Error) => err ? reject(err) : resolve());
    });
}

export const fs = {
    ...promises,
    fileExists,
    folderExists,
    rimraf
}

