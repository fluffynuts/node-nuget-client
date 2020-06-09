import "expect-even-more-jest";
import { NugetClient } from "../src/nuget-client";
import { Sandbox } from "filesystem-sandbox";
import * as path from "path";

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
        });
    });

    describe(`downloadPackage`, () => {
        it(`should download the package to the specified folder with standard nuget structure (1)`, async () => {
            jest.setTimeout(60000);
            // Arrange
            const
                sandbox = await Sandbox.create(),
                version = "1.2.316",
                packageId = "PeanutButter.Utils",
                expectedFolder = path.join(sandbox.path, `${packageId}.${version}`),
                sut = create();
            // Act
            const result = await sut.downloadPackage({
                packageId,
                version,
                output: sandbox.path
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
        });

        it(`should download the package to the specified folder with standard nuget structure (2)`, async () => {
            jest.setTimeout(60000);
            // Arrange
            const
                sandbox = await Sandbox.create(),
                version = "1.2.317",
                packageId = "PeanutButter.Utils",
                fullName = `${packageId}.${version}`,
                expectedFolder = path.join(sandbox.path, `${packageId}.${version}`),
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

    function create() {
        return new NugetClient();
    }
});
