import "expect-even-more-jest";
import { parseXml } from "../src/xml-to-json";
import { NugetConfig } from "../src/try-find-nuget-config";

describe(`xml-to-json`, () => {
  describe(`toJson`, () => {
    it(`should return {} for empty string`, async () => {
      // Arrange
      // Act
      const result = parseXml("");
      // Assert
      expect(result)
        .toEqual({});
    });

    it(`should return the single root element`, async () => {
      // Arrange
      const xml = `
<doc>hello</doc>
      `
      const expected = {
        doc: "hello"
      }
      // Act
      const result = parseXml(xml);
      // Assert
      expect(result)
        .toEqual(expected);
    });

    it(`should return single-level nested items`, async () => {
      // Arrange
      const xml = `
<Order>
  <LineItem>cat</LineItem>
  <LineItem>dog</LineItem>
</Order>`
      const expected = {
        Order: {
          LineItem: [
            "cat",
            "dog"
          ]
        }
      }
      // Act
      const result = parseXml(xml);
      // Assert
      expect(result)
        .toEqual(expected);
    });

    it(`should discard text when there's sibling nodes`, async () => {
      // this conforms to the xml2json way, and this local module is meant to
      // drop in to replace that because native modules suck.
      // Arrange
      const xml = `
<Order>
  should be chucked
  <LineItem>cat</LineItem>
  <LineItem>dog</LineItem>
</Order>`
      const expected = {
        Order: {
          LineItem: [
            "cat",
            "dog"
          ]
        }
      }
      // Act
      const result = parseXml(xml);
      // Assert
      expect(result)
        .toEqual(expected);
    });

    it(`should parse a valid nuget config file with one source`, async () => {
      // Arrange
      const expected = {
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
      // const result = parse<NugetConfig>(nuget_dot_config);
      const result = parseXml<NugetConfig>(nuget_dot_config1);
      // Assert
      expect(result)
        .toEqual(expected);

    });
    it(`should parse a valid nuget config file with one source`, async () => {
      // Arrange
      const expected = {
        configuration: {
          packageSources: {
            add: [{
              key: "nuget.org",
              value: "https://api.nuget.org/v3/index.json",
              protocolVersion: "3"
            }, {
              key: "fuget.org",
              value: "https://api.fuget.org/v3/index.json",
              protocolVersion: "3"
            }]
          }
        }
      }
      // Act
      // const result = parse<NugetConfig>(nuget_dot_config);
      const result = parseXml<NugetConfig>(nuget_dot_config2);
      // Assert
      expect(result)
        .toEqual(expected);

    });
  });

  const nuget_dot_config1 = `
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
  </packageSources>
</configuration>
    `.trim();
  const nuget_dot_config2 = `
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
    <add key="fuget.org" value="https://api.fuget.org/v3/index.json" protocolVersion="3" />
  </packageSources>
</configuration>
    `.trim();

});
