export const WIZARD_STEPS = [
  { id: 1, label: "Project Info" },
  { id: 2, label: "Template" },
  { id: 3, label: "Spreadsheet" },
  { id: 4, label: "Field Mapping" },
  { id: 5, label: "Email" },
  { id: 6, label: "Review & Send" },
] as const;

// Increase this number as each new step gets built.
export const LAST_AVAILABLE_STEP = 4;