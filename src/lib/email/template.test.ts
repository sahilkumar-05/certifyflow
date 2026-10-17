import { describe, expect, it } from "vitest";
import {
  buildVariables,
  extractPlaceholders,
  findUnknownPlaceholders,
  renderSubject,
  renderTemplate,
} from "./template";

const project = { eventName: "Tech Summit", projectName: "Bootcamp" };
const vars = buildVariables(
  { Name: "Sahil Kumar", Course: "Web Development", "Reference Number": "CF001", Note: "" },
  project
);

describe("renderTemplate", () => {
  it("replaces placeholders", () => {
    const r = renderTemplate("Dear {{Name}}, welcome to {{EventName}}.", vars);
    expect(r.text).toBe("Dear Sahil Kumar, welcome to Tech Summit.");
    expect(r.unknown).toEqual([]);
  });

  it("ignores case and extra spaces", () => {
    const r = renderTemplate("{{ name }} / {{reference   number}}", vars);
    expect(r.text).toBe("Sahil Kumar / CF001");
  });

  it("leaves unknown placeholders as written and reports them", () => {
    const r = renderTemplate("Hi {{Nickname}}", vars);
    expect(r.text).toBe("Hi {{Nickname}}");
    expect(r.unknown).toEqual(["Nickname"]);
  });

  it("reports empty values", () => {
    const r = renderTemplate("Note: {{Note}}", vars);
    expect(r.text).toBe("Note: ");
    expect(r.empty).toEqual(["Note"]);
  });

  it("lets project values win over a column with the same name", () => {
    const v = buildVariables({ EventName: "From sheet" }, project);
    expect(renderTemplate("{{EventName}}", v).text).toBe("Tech Summit");
  });

  it("does not treat prototype names as values", () => {
    const r = renderTemplate("{{__proto__}} {{constructor}}", vars);
    expect(r.unknown).toEqual(["__proto__", "constructor"]);
  });
});

describe("renderSubject", () => {
  it("removes line breaks, including ones coming from data", () => {
    const v = buildVariables({ Name: "A\r\nBcc: x@y.com" }, project);
    expect(renderSubject("Hello {{Name}}", v).text).toBe("Hello A Bcc: x@y.com");
  });
});

describe("placeholder helpers", () => {
  it("extracts unique placeholders", () => {
    expect(extractPlaceholders("{{A}} {{ B }} {{A}} {{ }}")).toEqual(["A", "B"]);
  });

  it("finds unknown placeholders", () => {
    expect(
      findUnknownPlaceholders("{{Name}} {{Foo}} {{eventname}}", ["Name", "EventName"])
    ).toEqual(["Foo"]);
  });
});