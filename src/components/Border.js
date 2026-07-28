// borders.js
// Template file for managing shop items and avatar border assets
//
// PARTICLE SYSTEM
// ----------------
// Add these optional fields to any border to layer real CSS particles
// on top of (or instead of) the PNG ring:
//
//   hasParticles     bool     turn particles on for this border
//   particleStyle    string   'orbit' | 'scatter' | 'comet' | 'multicolor'
//   particleCount    number   how many particles (default 6)
//   particleSize     number   px diameter of each particle (default 4)
//   particleDuration number   seconds per full orbit (default 4)
//   particleColor    string   single color, used by 'orbit' / 'scatter' / 'comet'
//   particleColors   array    list of colors, used by 'multicolor' (cycles per-particle)
//   particleRings    number   for 'scatter' only — how many concentric rings (default 2)
//   twinkle          bool     add an opacity/scale pulse on top of the orbit motion

export const SHOP_BORDERS = [
  {
    id: "relic_1",
    name: "Relic",
    price: 150,
    isImage: true,
    assetPath: "/avatars/relic_1.png",
    blendMode: "normal",
    inset: "-16px",
    animation: "-global-spin-particles 6s linear infinite",
    // warm embers drifting around the ring
    hasParticles: true,
    particleStyle: "orbit",
    particleColor: "#ffb347",
    particleCount: 8,
    particleSize: 4,
    particleDuration: 5,
    twinkle: true,
  },
  {
    id: "ph_flag_1",
    name: "Philippines",
    price: 150,
    isImage: true,
    assetPath: "/avatars/ph_1.png",
    blendMode: "normal",
    inset: "-16px",
    animation: "-global-spin-particles 6s linear infinite",
    // red / blue / gold cycling around the ring, one color per particle
    hasParticles: true,
    particleStyle: "multicolor",
    particleColors: ["#0038a8", "#ce1126", "#fcd116"],
    particleCount: 9,
    particleSize: 4,
    particleDuration: 6,
  },
  {
    id: "barbie_1",
    name: "Barbie Theme",
    price: 150,
    isImage: true,
    assetPath: "/avatars/barbie_1.png",
    blendMode: "normal",
    inset: "-16px",
    animation: "-global-spin-particles 6s linear infinite",
    // scattered hot-pink aura at two different radii instead of one tight ring
    hasParticles: true,
    particleStyle: "scatter",
    particleColor: "#ff3fa4",
    particleCount: 10,
    particleSize: 3,
    particleDuration: 4,
    particleRings: 2,
    twinkle: true,
  },
  {
    id: "naruto_1",
    name: "Naruto Theme",
    price: 150,
    isImage: true,
    assetPath: "/avatars/naruto_1.png",
    blendMode: "normal",
    inset: "-16px",
    animation: "-global-spin-particles 6s linear infinite",
    // orange chakra streaks with a comet tail
    hasParticles: true,
    particleStyle: "comet",
    particleColor: "#ff7a00",
    particleCount: 5,
    particleSize: 4,
    particleDuration: 2.5,
  },
  {
    id: "naruto_2",
    name: "Uchiha Theme",
    price: 150,
    isImage: true,
    assetPath: "/avatars/naruto_2.png",
    blendMode: "normal",
    inset: "-16px",
    animation: "-global-spin-particles 6s linear infinite",
    // same comet mechanic, red sharingan flavor, slightly slower
    hasParticles: true,
    particleStyle: "comet",
    particleColor: "#e0102b",
    particleCount: 4,
    particleSize: 4,
    particleDuration: 3,
  },
  {
    id: "onepiece_1",
    name: "One Piece Theme",
    price: 150,
    isImage: true,
    assetPath: "/avatars/onepiece_1.png",
    blendMode: "normal",
    inset: "-16px",
    animation: "-global-spin-particles 6s linear infinite",
    // scattered gold aura, treasure-glint feel
    hasParticles: true,
    particleStyle: "scatter",
    particleColor: "#ffd23f",
    particleCount: 8,
    particleSize: 3,
    particleDuration: 5,
    particleRings: 2,
    twinkle: true,
  },
];
