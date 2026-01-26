// Module-level Map storing the last successfully sent prompt per pane.
// Survives component remounts since it lives outside React state.
export const lastPromptByPane = new Map<string, string>()
