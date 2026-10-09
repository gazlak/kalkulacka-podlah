export const fmtDate = (t: number) => new Date(t).toLocaleDateString("cs-CZ");
export const fmtTime = (t: number) => new Date(t).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
