const os = require("os");

// Interfaces we never want to advertise
const IGNORED_INTERFACE_PATTERNS = [
  /^vEthernet/i, // Hyper-V
  /^VirtualBox/i, // VirtualBox host-only
  /^VMware/i, // VMware
  /^vboxnet/i,
  /^docker/i,
  /^br-/,
  /^virbr/i,
  /^utun/i, // macOS VPN tunnels
  /^tun/i,
  /^tap/i,
  /^zt/i, // ZeroTier
  /^tailscale/i,
];

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries) continue;
    if (IGNORED_INTERFACE_PATTERNS.some((re) => re.test(name))) continue;

    for (const entry of entries) {
      if (
        entry.family === "IPv4" &&
        !entry.internal &&
        isPrivateIPv4(entry.address) &&
        !addresses.includes(entry.address)
      ) {
        addresses.push(entry.address);
      }
    }
  }

  return addresses;
}

function isPrivateIPv4(address) {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)
  )
    return false;

  const [a, b] = parts;
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  );
}

module.exports = { getLocalIPv4Addresses };
