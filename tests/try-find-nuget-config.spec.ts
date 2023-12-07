import "expect-even-more-jest"
import { tryReadNugetConfig } from "../src/try-find-nuget-config";
import { Sandbox } from "filesystem-sandbox";

describe(`try-find-nuget-config`, () => {
  describe(`tryReadNugetConfig`, () => {
    it(`should return the nuget config`, async () => {
      // Arrange
      const
        sandbox = await Sandbox.create(),
        configPath = await sandbox.writeFile("NuGet.Config", nuget_dot_config),
        expected = {
          configuration: {
            packageSources: {
              add: {
                key: "nuget.org",
                value: "https://api.nuget.org/v3/index.json",
                protocolVersion: "3"
              }
            }
          }
        }
      // Act
      const result = tryReadNugetConfig(configPath);
      // Assert
      expect(result)
        .toEqual(expected);
    });

    const nuget_dot_config = `
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
  </packageSources>
</configuration>
    `.trim();
  });
});
