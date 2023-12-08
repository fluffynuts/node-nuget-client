import { DOMParser } from "@xmldom/xmldom";

export function parseXml<T extends object>(xml: string): T | undefined {
  if (!xml || !xml.trim()) {
    return {} as T;
  }
  const
    parser = new DOMParser(),
    doc = parser.parseFromString(xml);
  return {
    [doc.documentElement.tagName]: makeJsonNode(doc.documentElement)
  } as T;
}

function makeJsonNode(
  el: Element
): string | Object | undefined | Array<string | Object> {
  if (!el.tagName) {
    return el.nodeValue || undefined
  }
  const result = {} as any;
  const gatheredText = [] as string[];
  let fallBackOnText = true;
  for (const attrib of Array.from(el.attributes)) {
    fallBackOnText = false;
    result[attrib.name] = attrib.value;
  }
  for (const child of Array.from(el.childNodes)) {
    const childEl = child as HTMLElement;
    if (!childEl.tagName) {
      if (childEl.nodeValue) {
        gatheredText.push(childEl.nodeValue)
      }
      continue;
    }
    const tag = childEl.tagName;
    if (!tag) {
      continue;
    }
    fallBackOnText = false;
    if (result[tag]) {
      if (!Array.isArray(result[tag])) {
        result[tag] = [ result[tag] ];
      }
      result[tag].push(makeJsonNode(child as HTMLElement));
    } else {
      result[tag] = makeJsonNode(child as HTMLElement);
    }
  }
  if (fallBackOnText) {
    return gatheredText.join("");
  }
  return result;
}
