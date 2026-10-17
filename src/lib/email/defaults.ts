export const DEFAULT_EMAIL_SUBJECT = "Congratulations! Your Certificate for {{EventName}}";

// Uses the participant's name column, because column names differ between spreadsheets.
export function defaultEmailBody(nameColumn: string | null): string {
  const name = nameColumn?.trim() || "Name";
  return [
    `Dear {{${name}}},`,
    "",
    "Thank you for being part of {{EventName}}.",
    "",
    "Your personalized certificate is attached to this email.",
    "",
    "Best Regards,",
    "Event Management Team",
  ].join("\n");
}