export function receiptQrPayload(receiptNumber: string, orderId: string): string {
  const publicBaseUrl = process.env.PUBLIC_APP_URL || "http://localhost:5173";
  return `${publicBaseUrl}/receipt/${encodeURIComponent(orderId)}?receipt=${encodeURIComponent(receiptNumber)}`;
}

export function qrSvgDataUri(payload: string): string {
  const escaped = payload.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="white"/><rect x="8" y="8" width="24" height="24" fill="black"/><rect x="64" y="8" width="24" height="24" fill="black"/><rect x="8" y="64" width="24" height="24" fill="black"/><path d="M40 40h8v8h-8zM56 40h8v8h-8zM72 48h8v8h-8zM40 56h16v8H40zM64 64h8v8h-8zM48 72h8v8h-8zM80 80h8v8h-8z" fill="black"/><title>${escaped}</title></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
