import "expect-even-more-jest";
import { NugetClient } from "../src/nuget-client";
import { Sandbox } from "filesystem-sandbox";
import * as path from "path";
import { exec } from "child_process";
import { createReadStream } from "fs";
import { createHash } from "crypto";
import { readFile, fileExists, FsEntities, ls, stat, writeTextFile } from "yafs";
import { tryFindNugetConfig } from "../src/try-find-nuget-config";

describe(`nuget-api`, () => {
  describe(`fetchResources`, () => {
    it(`should fetch the resources`, async () => {
      // Arrange
      const sut = create();
      // Act
      const result = await sut.fetchResources();
      // Assert
      expect(result.version)
        .toEqual("3.0.0");
      expect(result.resources)
        .not.toBeEmptyArray();
      const queryServiceInfo = result.resources.find(
        r => r._type === "SearchQueryService"
      );
      expect(queryServiceInfo)
        .toBeDefined();
    });
  });

  describe(`findPackage`, () => {
    describe(`when given version`, () => {
      it(`should return info for that version`, async () => {
        // Arrange
        const sut = create();
        // Act
        const info = await sut.findPackage({
          packageId: "PeanutButter.Utils",
          version: "1.0.117"
        });

        // Assert
        expect(info)
          .toBeDefined();
        if (info === undefined) {
          // please the ts compiler
          return;
        }
        expect(info.version)
          .toEqual("1.0.117");
        expect(info.id)
          .toEqual("PeanutButter.Utils");
        expect(info.description)
          .toBeDefined();
        expect(info.summary)
          .toBeDefined();
        expect(info.title)
          .toBeDefined();
        expect(info.iconUrl)
          .toBeDefined();
        expect(info.licenseUrl)
          .toBeDefined();
        expect(info.tags)
          .toBeArray();
        expect(info.authors)
          .toBeArray();
        expect(info.totalDownloads)
          .toBeGreaterThan(0);
        expect(info.downloads)
          .toBeGreaterThan(0);
        expect(info.verified)
          .toBeDefined();
        expect(info.indexUrl)
          .toBeDefined();

      });

      it(`should return info for that version (source specified)`, async () => {
        // Arrange
        await createNugetConfigIfMissing();
        const sut = create("nuget.org");
        // Act
        const info = await sut.findPackage({
          packageId: "PeanutButter.Utils",
          version: "1.0.117"
        });

        // Assert
        expect(info)
          .toBeDefined();
        if (info === undefined) {
          // please the ts compiler
          return;
        }
        expect(info.version)
          .toEqual("1.0.117");
        expect(info.id)
          .toEqual("PeanutButter.Utils");
        expect(info.description)
          .toBeDefined();
        expect(info.summary)
          .toBeDefined();
        expect(info.title)
          .toBeDefined();
        expect(info.iconUrl)
          .toBeDefined();
        expect(info.licenseUrl)
          .toBeDefined();
        expect(info.tags)
          .toBeArray();
        expect(info.authors)
          .toBeArray();
        expect(info.totalDownloads)
          .toBeGreaterThan(0);
        expect(info.downloads)
          .toBeGreaterThan(0);
        expect(info.verified)
          .toBeDefined();
        expect(info.indexUrl)
          .toBeDefined();

      });

      async function createNugetConfigIfMissing() {
        const existing = tryFindNugetConfig();
        if (!!existing) {
          return;
        }
        const target = path.join(
          `${ process.env.HOME }`,
          ".config",
          "NuGet",
          "config",
          "NuGet.config"
        );
        await writeTextFile(
          target,
          `
<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
  </packageSources>
  <packageSourceCredentials>
    <nuget.org>
      <add key="Username" value="dingdong" />
      <add key="ClearTextPassword" value="not-gonna-work" />
    </nuget.org>
  </packageSourceCredentials>
</configuration>
          `.trim()
        )
      }
    });
  });

  describe(`downloadPackage`, () => {
    it(`should download the package to the specified folder with standard nuget structure (1)`, async () => {
      // Arrange
      const
        sutSandbox = await Sandbox.create(),
        version = "1.2.316",
        packageId = "PeanutButter.Utils",
        intermediateFolder = "build-tools",
        someAdjacentFile = await sutSandbox.writeFile(
          path.join("adjacent", "readme.txt"), "hello"
        ),
        output = path.join(sutSandbox.path, intermediateFolder),
        expectedFolder = path.join(output, `${ packageId }.${ version }`),
        sut = create();

      // Act
      const result = await sut.downloadPackage({
        packageId,
        version,
        output
      })
      // Assert
      if (!result) {
        throw new Error("no result");
      }
      expect(expectedFolder)
        .toBeFolder();
      expect(path.join(expectedFolder, "lib"))
        .toBeFolder();
      expect(path.join(expectedFolder, "package"))
        .toBeFolder();
      expect(path.join(expectedFolder, "PeanutButter.Utils.nuspec"))
        .toBeFile();

      expect(result.fullName)
        .toEqual("PeanutButter.Utils.1.2.316");
      expect(result.id)
        .toEqual(packageId);
      expect(result.version)
        .toEqual(version);
      expect(result.fullPath)
        .toEqual(expectedFolder);

      expect(someAdjacentFile)
        .toExist();
    });

    describe(`using a token to connect`, () => {
      const
        repo = "https://nuget.pkg.github.com/codeo-za/index.json",
        user = process.env.GIT_USER,
        token = process.env.GIT_TOKEN;
      if (!!user && !!token) {
        it(`should fetch package info`, async () => {
          // Arrange
          const client = new NugetClient(repo, user, token);
          // Act
          const result = await client.fetchPackageInfo("codeo.core");
          // Assert
          expect(result)
            .toBeDefined();
          expect(result.data)
            .toBeDefined();
        });
      }
    });

    it(`should download the exact same stuff as nuget.exe does`, async () => {
      // Arrange
      const
        sutSandbox = await Sandbox.create(),
        referenceSandbox = await Sandbox.create();
      // Act
      await Promise.all([
        downloadWithNuget(),
        downloadWithSut()
      ]);

      // Assert
      const [ referenceFiles, sutFiles ] = await Promise.all([
        listFilesUnder(referenceSandbox.path),
        listFilesUnder(sutSandbox.path)
      ]);

      if (referenceFiles.length != sutFiles.length) {
        const missing = [] as string[];
        for (const ref of referenceFiles) {
          if (!sutFiles.find(o => o.path === ref.path)) {
            missing.push(ref.path);
          }
        }
        expect(missing)
          .toBeEmptyArray();
      }
      for (const ref of referenceFiles) {
        const sutFile = sutFiles.find(o => o.path === ref.path);
        expect(sutFile)
          .toBeDefined();
        expect(sutFile)
          .toEqual(ref);
        // verify data
        const fullRefPath = path.join(referenceSandbox.path, ref.path);
        expect(fullRefPath)
          .toBeFile();
        const expectedData = await readFile(fullRefPath);
        const fullSutPath = path.join(sutSandbox.path, sutFile!.path);
        expect(fullSutPath)
          .toBeFile();
        const resultData = await readFile(fullSutPath);

        expect(resultData)
          .toEqual(expectedData);
      }


      async function downloadWithNuget(): Promise<void> {
        await new Promise<void>((resolve, reject) => {
          exec(`nuget install nunit.consolerunner -outputdirectory "${ referenceSandbox.path }"`, err => {
            return err
              ? reject(err)
              : resolve();
          });
        });
      }

      async function downloadWithSut(): Promise<void> {
        const client = new NugetClient();
        await client.downloadPackage({
          packageId: "nunit.consolerunner",
          output: sutSandbox.path
        });
      }

      async function listFilesUnder(p: string): Promise<FileInfo[]> {
        const files = await ls(p, {
          recurse: true,
          entities: FsEntities.files,
          fullPaths: false
        });
        const
          result = [] as FileInfo[],
          hashPromises = [] as Promise<void>[];
        for (const file of files) {
          const fullPath = path.join(p, file);
          const st = await stat(fullPath);
          if (!st) {
            throw new Error(`unable to stat file at: ${ fullPath }`);
          }
          const info = {
            path: file,
            size: st.size
          } as FileInfo;
          result.push(info);
          hashPromises.push(hashFile(fullPath).then(hash => info.hash = hash).then(() => {
          }));
        }
        await Promise.all(hashPromises);
        return result;
      }
    });

    async function hashFile(p: string): Promise<string> {
      const md5 = createHash("md5");
      return new Promise<string>((resolve, reject) => {
        const stream = createReadStream(p);
        stream.on("data", d => md5.update(d));
        stream.on("close", () => {
          resolve(
            md5.digest("hex")
          );
        });
        stream.on("error", reject);
      });
    }

    interface FileInfo {
      path: string;
      size: number;
      hash: string;
    }

    it(`should download the package to the specified folder with standard nuget structure (2)`, async () => {
      // Arrange
      const
        sandbox = await Sandbox.create(),
        version = "1.2.317",
        packageId = "PeanutButter.Utils",
        fullName = `${ packageId }.${ version }`,
        expectedFolder = path.join(sandbox.path, `${ packageId }.${ version }`),
        sut = create();
      // Act
      await sut.downloadPackage({
        packageId: fullName,
        output: sandbox.path
      })
      // Assert
      expect(expectedFolder)
        .toBeFolder();
      expect(path.join(expectedFolder, "lib"))
        .toBeFolder();
      expect(path.join(expectedFolder, "package"))
        .toBeFolder();
      expect(path.join(expectedFolder, "PeanutButter.Utils.nuspec"))
        .toBeFile();
    });
  });

  afterEach(async () => {
    await Sandbox.destroyAll();
  });

  function create(registry?: string) {
    return new NugetClient(registry);
  }
});
