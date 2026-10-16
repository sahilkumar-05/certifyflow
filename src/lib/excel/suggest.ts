const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Guesses which columns hold the name, email and reference number.
// Returns empty strings for anything it cannot find.
export function suggestMapping(headers: string[]) {
  const used = new Set<string>();

  const find = (test: (normalized: string) => boolean) => {
    const match = headers.find((h) => !used.has(h) && test(clean(h)));
    if (match) used.add(match);
    return match ?? "";
  };

  const emailColumn = find((n) => n.includes("email") || n === "mail");

  const nameColumn =
    find((n) =>
      [
        "name",
        "fullname",
        "participantname",
        "studentname",
        "recipientname",
        "candidatename",
      ].includes(n)
    ) ||
    find(
      (n) => n.includes("name") && !/(course|event|module|file|company|father)/.test(n)
    );

  const referenceColumn = find(
    (n) =>
      n.includes("reference") ||
      /^(ref|refno|refnumber|id|certificateid|certificateno|certificatenumber|serial|serialno|serialnumber)$/.test(n)
  );

  return { nameColumn, emailColumn, referenceColumn };
}