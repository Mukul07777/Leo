export function isLightColor(hex) {
  const clean = (hex || "").replace("#", "");
  if (clean.length !== 6) return true;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

export function avatarTextColor(hex) {
  return isLightColor(hex) ? "#0a0a0a" : "#fafafa";
}
