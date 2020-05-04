import "expect-more-jest";
import { NugetClient } from "../src/nuget-client";
const bent = require("bent");

describe(`nuget-api`, () => {
    it.skip(`discovery`, async () => {
        // Arrange
        const getJson = bent("json");
        // Act
        // example dl url: https://api.nuget.org/v3-flatcontainer/peanutbutter.tempdb.runner/1.2.360/peanutbutter.tempdb.runner.1.2.360.nupkg
        // this gets a package's info by id
        const moo = (await getJson("https://azuresearch-usnc.nuget.org/query?q=packageId:PeanutButter.TempDb.Runner")) as any;
        // in the results, there's gonna be an url like
        // https://api.nuget.org/v3/registration5-semver1/peanutbutter.tempdb.runner/1.2.360.json
        // -> this returns json with the packageContent
        // Assert
        console.log({
            foo: moo.resources[0]
        });

    });

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
                const info = await sut.findPackage(
                    "PeanutButter.Utils",
                    "1.0.117"
                );

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

    function create() {
        return new NugetClient();
    }
});
