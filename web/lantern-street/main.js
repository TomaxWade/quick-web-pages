const canvas = document.getElementById("streetCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const speedValue = document.getElementById("speedValue");
const sceneValue = document.getElementById("sceneValue");
const hintText = document.getElementById("hintText");

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const routeLength = 720;
const farZ = 230;
const nearZ = 1;
const movementScale = 0.25;
const baseSpeed = prefersReduced ? 0.14 : 0.25;

let width = 0;
let height = 0;
let dpr = 1;
let horizonY = 0;
let travel = 0;
let velocity = 0.1;
let touchY = 0;
let hasInteracted = false;
let frameZoom = 1;
let frameSwing = 0;
let framePulse = 0;
let userZoom = 1;
let pinchDistancePrev = null;

const sceneLabelMap = {
  riddle: "谜灯巷口",
  lantern: "花灯长廊",
  dragon: "龙舞正酣",
  lion: "狮跃鼓鸣",
  stilts: "高跷巡游",
  yangge: "秧歌转街",
  tangyuan: "元宵暖摊",
};

const actionCycle = ["riddle", "lantern", "dragon", "lion", "stilts", "yangge", "tangyuan"];
const stallCycle = ["lantern", "tangyuan", "sugar", "tea", "mask"];

const streetEntities = [];
const laneMarkers = [];
const particles = [];
const foregroundLanterns = [];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const mod = (value, modulo) => {
  const v = value % modulo;
  return v < 0 ? v + modulo : v;
};

const randFrom = (seed) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

const getTouchDistance = (touchA, touchB) => {
  const dx = touchA.clientX - touchB.clientX;
  const dy = touchA.clientY - touchB.clientY;
  return Math.hypot(dx, dy);
};

const resize = () => {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  horizonY = height * 0.27;
};

const buildWorld = () => {
  streetEntities.length = 0;
  laneMarkers.length = 0;
  particles.length = 0;
  foregroundLanterns.length = 0;

  for (let z = 0; z < routeLength; z += 6.5) {
    laneMarkers.push({ z });
  }

  for (let i = 0; i < 120; i += 1) {
    const z = i * 6;
    const leftSeed = i * 1.13 + 3.2;
    const rightSeed = i * 1.37 + 8.9;

    streetEntities.push({
      kind: "stall",
      stallType: stallCycle[i % stallCycle.length],
      side: "left",
      x: -3.7 - randFrom(leftSeed) * 2.1,
      z: z + randFrom(leftSeed + 9.7) * 2,
      seed: leftSeed,
    });

    streetEntities.push({
      kind: "stall",
      stallType: stallCycle[(i + 2) % stallCycle.length],
      side: "right",
      x: 3.7 + randFrom(rightSeed) * 2.1,
      z: z + randFrom(rightSeed + 4.1) * 2,
      seed: rightSeed,
    });

    streetEntities.push({
      kind: "lanternPost",
      side: "left",
      x: -2.15,
      z: z + 1.2,
      seed: i * 2.01 + 5.1,
    });

    streetEntities.push({
      kind: "lanternPost",
      side: "right",
      x: 2.15,
      z: z + 4.1,
      seed: i * 2.31 + 7.2,
    });

    if (i % 3 === 0) {
      streetEntities.push({
        kind: "banner",
        side: i % 2 === 0 ? "left" : "right",
        x: i % 2 === 0 ? -2.9 : 2.9,
        z: z + 2.2,
        seed: i * 1.77 + 13.2,
      });
    }

    if (i % 8 === 0) {
      streetEntities.push({
        kind: "archway",
        x: 0,
        z: z + 3.4,
        seed: i * 2.87 + 17.8,
      });
    }

    if (i % 4 === 0) {
      streetEntities.push({
        kind: "crowd",
        side: i % 8 === 0 ? "left" : "right",
        x: i % 8 === 0 ? -2.75 : 2.75,
        z: z + 2.8,
        count: 2 + (i % 3),
        seed: i * 3.11 + 29.1,
      });
    }

    if (i % 5 === 0) {
      const actionType = actionCycle[(i / 5) % actionCycle.length];
      const side = i % 10 === 0 ? "left" : "right";
      const x = side === "left" ? -2.4 : 2.4;
      streetEntities.push({
        kind: "action",
        actionType,
        side,
        x,
        z: z + 2.4,
        seed: i * 3.31 + 1.3,
      });
    }

    if (i % 10 === 0) {
      const centerAction = actionCycle[(i / 5 + 2) % actionCycle.length];
      if (centerAction === "dragon" || centerAction === "lion") {
        streetEntities.push({
          kind: "action",
          actionType: centerAction,
          side: "center",
          x: 0,
          z: z + 4.5,
          seed: i * 4.22 + 6.4,
        });
      }
    }
  }

  for (let i = 0; i < 260; i += 1) {
    particles.push({
      x: randFrom(i * 4.11),
      y: randFrom(i * 1.93 + 23),
      speed: 0.35 + randFrom(i * 7.1) * 1.1,
      size: 0.35 + randFrom(i * 2.9 + 1.2) * 1.4,
      warm: randFrom(i * 5.19) > 0.35,
      seed: i * 0.73,
    });
  }

  for (let i = 0; i < 18; i += 1) {
    foregroundLanterns.push({
      side: i % 2 === 0 ? -1 : 1,
      yOffset: 0.09 + randFrom(i * 0.91) * 0.23,
      size: 20 + randFrom(i * 1.72) * 28,
      sway: 0.5 + randFrom(i * 2.41) * 1.8,
      laneShift: randFrom(i * 1.03 + 4.7),
      seed: i * 2.19,
    });
  }
};

const project = (worldX, worldZ) => {
  const relZ = mod(worldZ - travel, routeLength);
  if (relZ < nearZ || relZ > farZ) {
    return null;
  }

  const depth = (relZ - nearZ) / (farZ - nearZ);
  const nearFactor = 1 - depth;
  const scale = (0.34 + nearFactor * 2.86) * frameZoom * userZoom;
  const y = horizonY + Math.pow(nearFactor, 1.14) * height * 0.74;
  const x = width * 0.5 + frameSwing * 26 + worldX * scale * 92;

  return {
    relZ,
    depth,
    nearFactor,
    scale,
    x,
    y,
    alpha: 0.2 + nearFactor * 0.85,
  };
};

const drawLanternGlow = (x, y, r, alpha = 1) => {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  glow.addColorStop(0, `rgba(255, 236, 175, ${0.78 * alpha})`);
  glow.addColorStop(0.35, `rgba(255, 176, 93, ${0.42 * alpha})`);
  glow.addColorStop(1, "rgba(255, 176, 93, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, Math.PI * 2);
  ctx.fill();
};

const drawSky = (t) => {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#070d1a");
  sky.addColorStop(0.42, "#1b1738");
  sky.addColorStop(0.76, "#2f1d2b");
  sky.addColorStop(1, "#3a180f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const moonX = width * 0.8 + Math.sin(t * 0.0002) * 10;
  const moonY = height * 0.14;
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 2, moonX, moonY, 92);
  moonGlow.addColorStop(0, "rgba(255, 245, 212, 0.93)");
  moonGlow.addColorStop(1, "rgba(255, 245, 212, 0)");
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 92, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff2cc";
  ctx.beginPath();
  ctx.arc(moonX, moonY, 23, 0, Math.PI * 2);
  ctx.fill();

  const fireworkCount = prefersReduced ? 3 : 8;
  for (let i = 0; i < fireworkCount; i += 1) {
    const period = 3.3 + (i % 3) * 0.7;
    const phase = mod(t * 0.001 + i * 0.91, period);
    const life = phase / 1.06;
    if (life > 1) {
      continue;
    }

    const fx = width * (0.11 + randFrom(i * 9.7) * 0.78);
    const fy = height * (0.08 + randFrom(i * 3.3) * 0.3);
    const radius = 8 + life * (42 + (i % 4) * 8);
    const alpha = 1 - life;

    ctx.save();
    ctx.globalAlpha = alpha * 0.8;
    const rays = 14 + (i % 4) * 3;
    for (let k = 0; k < rays; k += 1) {
      const a = (k / rays) * Math.PI * 2;
      const x = fx + Math.cos(a) * radius;
      const y = fy + Math.sin(a) * radius;
      ctx.strokeStyle = i % 2 === 0 ? `rgba(255, ${172 + k * 3}, 83, ${0.78 - k * 0.02})` : `rgba(${216 + k}, ${125 + k * 2}, 255, ${0.74 - k * 0.02})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();
  }
};

const drawBackgroundBuildings = (t) => {
  const shift = mod(travel * 1.9, 140);
  const baseY = horizonY + 32;

  for (let i = -2; i < Math.ceil(width / 140) + 2; i += 1) {
    const x = i * 140 - shift;
    const blockH = 80 + randFrom(i * 2.7 + 1.1) * 120;

    const buildingGrad = ctx.createLinearGradient(0, baseY - blockH, 0, baseY);
    buildingGrad.addColorStop(0, "rgba(30, 22, 45, 0.9)");
    buildingGrad.addColorStop(1, "rgba(20, 13, 30, 0.88)");
    ctx.fillStyle = buildingGrad;
    ctx.fillRect(x, baseY - blockH, 110, blockH);

    ctx.fillStyle = "rgba(249, 194, 98, 0.24)";
    for (let w = 0; w < 4; w += 1) {
      for (let h = 0; h < 6; h += 1) {
        const wx = x + 12 + w * 24;
        const wy = baseY - blockH + 14 + h * 17;
        if (randFrom(wx * 0.17 + wy * 0.91 + t * 0.00001) > 0.43) {
          ctx.fillRect(wx, wy, 12, 9);
        }
      }
    }

    const roofSwing = Math.sin(t * 0.0008 + i) * 1.2;
    ctx.fillStyle = "rgba(96, 36, 33, 0.8)";
    ctx.beginPath();
    ctx.moveTo(x - 5, baseY - blockH);
    ctx.lineTo(x + 56, baseY - blockH - 12 - roofSwing);
    ctx.lineTo(x + 115, baseY - blockH);
    ctx.closePath();
    ctx.fill();
  }

  const haze = ctx.createLinearGradient(0, baseY - 220, 0, baseY + 70);
  haze.addColorStop(0, "rgba(255, 210, 135, 0)");
  haze.addColorStop(1, "rgba(255, 185, 125, 0.2)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, baseY - 220, width, 290);
};

const drawRoad = (t) => {
  const roadTopWidth = width * 0.1;
  const roadBottomWidth = width * 0.78;
  const center = width * 0.5 + frameSwing * 18;
  const roadBottomY = height * 0.985;

  const roadGrad = ctx.createLinearGradient(0, horizonY, 0, roadBottomY);
  roadGrad.addColorStop(0, "#2f1f1e");
  roadGrad.addColorStop(0.48, "#613133");
  roadGrad.addColorStop(1, "#251314");

  ctx.fillStyle = roadGrad;
  ctx.beginPath();
  ctx.moveTo(center - roadTopWidth * 0.5, horizonY);
  ctx.lineTo(center + roadTopWidth * 0.5, horizonY);
  ctx.lineTo(center + roadBottomWidth * 0.5, roadBottomY);
  ctx.lineTo(center - roadBottomWidth * 0.5, roadBottomY);
  ctx.closePath();
  ctx.fill();

  const glowBoost = 0.25 + framePulse * 0.25;
  const edgeGlow = ctx.createLinearGradient(0, horizonY, 0, roadBottomY);
  edgeGlow.addColorStop(0, `rgba(255, 193, 118, ${0.18 + glowBoost * 0.1})`);
  edgeGlow.addColorStop(1, `rgba(255, 132, 72, ${0.5 + glowBoost * 0.2})`);
  ctx.strokeStyle = edgeGlow;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(center - roadTopWidth * 0.5, horizonY);
  ctx.lineTo(center - roadBottomWidth * 0.5, roadBottomY);
  ctx.moveTo(center + roadTopWidth * 0.5, horizonY);
  ctx.lineTo(center + roadBottomWidth * 0.5, roadBottomY);
  ctx.stroke();

  laneMarkers.forEach((marker) => {
    const p = project(0, marker.z);
    if (!p) {
      return;
    }

    const markerW = p.scale * 6;
    const markerH = p.scale * 24;
    ctx.fillStyle = `rgba(255, 236, 188, ${p.alpha * 0.8})`;
    ctx.fillRect(p.x - markerW * 0.5, p.y - markerH, markerW, markerH);
  });

  const roadShimmer = Math.sin(t * 0.0035) * 0.5 + 0.5;
  ctx.fillStyle = `rgba(255, 202, 116, ${0.06 + roadShimmer * 0.04})`;
  ctx.beginPath();
  ctx.moveTo(center - roadTopWidth * 0.25, horizonY + 3);
  ctx.lineTo(center + roadTopWidth * 0.25, horizonY + 3);
  ctx.lineTo(center + roadBottomWidth * 0.2, roadBottomY);
  ctx.lineTo(center - roadBottomWidth * 0.2, roadBottomY);
  ctx.closePath();
  ctx.fill();
};

const drawPerson = (x, y, scale, color, swing = 0, tall = 1, alpha = 1) => {
  const headR = 3.4 * scale;
  const bodyH = 11 * scale * tall;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 1.25 * scale);
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x, y - bodyH);
  ctx.lineTo(x, y - headR * 1.8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y - bodyH * 0.68);
  ctx.lineTo(x - 5.4 * scale, y - bodyH * 0.48 + swing * 1.3 * scale);
  ctx.moveTo(x, y - bodyH * 0.68);
  ctx.lineTo(x + 5.4 * scale, y - bodyH * 0.48 - swing * 1.3 * scale);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y - headR * 1.8);
  ctx.lineTo(x - 3.2 * scale, y + 6 * scale);
  ctx.moveTo(x, y - headR * 1.8);
  ctx.lineTo(x + 3.2 * scale, y + 6 * scale);
  ctx.stroke();

  ctx.fillStyle = "#f8e6c7";
  ctx.beginPath();
  ctx.arc(x, y - bodyH - headR * 0.2, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawStall = (entity, p, t) => {
  const sway = Math.sin(t * 0.0017 + entity.seed) * 0.95;
  const w = 54 * p.scale;
  const h = 30 * p.scale;
  const baseY = p.y;
  const type = entity.stallType;

  let awning = "#9c2b2d";
  let sign = "rgba(247, 196, 92, 0.88)";
  if (type === "tea") {
    awning = "#2f6f67";
    sign = "rgba(221, 241, 226, 0.85)";
  } else if (type === "sugar") {
    awning = "#7831a8";
    sign = "rgba(253, 211, 255, 0.84)";
  } else if (type === "mask") {
    awning = "#c55423";
    sign = "rgba(252, 220, 168, 0.9)";
  }

  ctx.save();
  ctx.globalAlpha = p.alpha;

  const bodyGrad = ctx.createLinearGradient(0, baseY - h, 0, baseY);
  bodyGrad.addColorStop(0, "#4b2024");
  bodyGrad.addColorStop(1, "#301215");
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(p.x - w * 0.5, baseY - h, w, h);

  ctx.fillStyle = awning;
  ctx.beginPath();
  ctx.moveTo(p.x - w * 0.64, baseY - h);
  ctx.lineTo(p.x + w * 0.64, baseY - h);
  ctx.lineTo(p.x + w * 0.46, baseY - h * 1.48 - sway * p.scale);
  ctx.lineTo(p.x - w * 0.46, baseY - h * 1.48 + sway * p.scale);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = sign;
  ctx.fillRect(p.x - w * 0.28, baseY - h * 0.84, w * 0.56, h * 0.42);

  drawLanternGlow(p.x - w * 0.35, baseY - h * 1.24, 3.5 * p.scale, p.alpha * 0.75);
  drawLanternGlow(p.x + w * 0.35, baseY - h * 1.24, 3.5 * p.scale, p.alpha * 0.75);

  ctx.fillStyle = type === "tea" ? "#4fb17f" : "#d43c31";
  ctx.beginPath();
  ctx.arc(p.x - w * 0.35, baseY - h * 1.24, 3 * p.scale, 0, Math.PI * 2);
  ctx.arc(p.x + w * 0.35, baseY - h * 1.24, 3 * p.scale, 0, Math.PI * 2);
  ctx.fill();

  if (type === "tangyuan") {
    ctx.fillStyle = "#f6d7a2";
    ctx.beginPath();
    ctx.arc(p.x, baseY - h * 0.35, 3.2 * p.scale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

const drawLanternPost = (entity, p, t) => {
  const wave = Math.sin(t * 0.002 + entity.seed) * 0.9;
  const postH = 40 * p.scale;

  ctx.save();
  ctx.globalAlpha = p.alpha;

  ctx.strokeStyle = "#6a412c";
  ctx.lineWidth = Math.max(1, 2.1 * p.scale);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x, p.y - postH);
  ctx.stroke();

  const lx = p.x + wave * p.scale;
  const ly = p.y - postH;
  drawLanternGlow(lx, ly, 5.2 * p.scale, p.alpha);

  ctx.fillStyle = "#d64736";
  ctx.beginPath();
  ctx.ellipse(lx, ly, 4.8 * p.scale, 6.2 * p.scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 215, 160, 0.65)";
  ctx.lineWidth = Math.max(1, 0.72 * p.scale);
  ctx.beginPath();
  ctx.moveTo(lx, ly - 5.2 * p.scale);
  ctx.lineTo(lx, ly + 5.2 * p.scale);
  ctx.stroke();

  ctx.restore();
};

const drawArchway = (p, t) => {
  const s = p.scale;
  const wave = Math.sin(t * 0.0012 + p.relZ * 0.05) * 1.8 * s;
  const w = 92 * s;
  const h = 64 * s;

  ctx.save();
  ctx.globalAlpha = p.alpha * 0.82;

  const pillarGrad = ctx.createLinearGradient(0, p.y - h, 0, p.y);
  pillarGrad.addColorStop(0, "#7d2428");
  pillarGrad.addColorStop(1, "#4a1416");
  ctx.fillStyle = pillarGrad;

  ctx.fillRect(p.x - w * 0.48, p.y - h, 11 * s, h);
  ctx.fillRect(p.x + w * 0.37, p.y - h, 11 * s, h);

  ctx.fillStyle = "#5f1b21";
  ctx.beginPath();
  ctx.moveTo(p.x - w * 0.62, p.y - h + 4 * s + wave);
  ctx.lineTo(p.x + w * 0.62, p.y - h + 4 * s - wave);
  ctx.lineTo(p.x + w * 0.53, p.y - h - 14 * s - wave);
  ctx.lineTo(p.x - w * 0.53, p.y - h - 14 * s + wave);
  ctx.closePath();
  ctx.fill();

  drawLanternGlow(p.x, p.y - h - 7 * s, 5.6 * s, p.alpha * 0.88);
  ctx.fillStyle = "#f0bf55";
  ctx.fillRect(p.x - 18 * s, p.y - h - 10 * s, 36 * s, 8 * s);

  ctx.restore();
};

const drawBanner = (entity, p, t) => {
  const s = p.scale;
  const wave = Math.sin(t * 0.004 + entity.seed) * 6 * s;
  const dir = entity.side === "left" ? -1 : 1;

  ctx.save();
  ctx.globalAlpha = p.alpha * 0.82;

  ctx.strokeStyle = "#6c3e2a";
  ctx.lineWidth = Math.max(1, 1.6 * s);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 30 * s);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();

  ctx.fillStyle = entity.side === "left" ? "#9e2c30" : "#c5572b";
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 29 * s);
  ctx.lineTo(p.x + dir * (24 * s + wave * 0.4), p.y - 23 * s + wave * 0.3);
  ctx.lineTo(p.x + dir * (22 * s + wave * 0.2), p.y - 9 * s + wave * 0.4);
  ctx.lineTo(p.x, p.y - 14 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
};

const drawCrowd = (entity, p, t) => {
  const s = p.scale;
  ctx.save();
  ctx.globalAlpha = p.alpha * 0.85;

  for (let i = 0; i < entity.count; i += 1) {
    const phase = t * 0.004 + entity.seed + i * 0.9;
    const localX = p.x + (i - (entity.count - 1) * 0.5) * 8 * s;
    const localY = p.y + Math.sin(phase) * 1.5 * s;
    const swing = Math.sin(phase) * 0.9;
    drawPerson(localX, localY, s * (0.66 + i * 0.08), "#f1c690", swing, 1, p.alpha * 0.9);
  }

  ctx.restore();
};

const drawRiddleScene = (p, t) => {
  const s = p.scale;
  const bob = Math.sin(t * 0.003 + p.relZ) * 1.5 * s;

  ctx.save();
  ctx.globalAlpha = p.alpha;

  ctx.fillStyle = "#7d2228";
  ctx.fillRect(p.x - 26 * s, p.y - 34 * s + bob, 36 * s, 23 * s);
  ctx.fillStyle = "#f4d082";
  ctx.fillRect(p.x - 21 * s, p.y - 29 * s + bob, 26 * s, 14 * s);

  drawPerson(p.x + 16 * s, p.y - 1 * s, s * 0.92, "#f9d18f", Math.sin(t * 0.005) * 0.8);
  drawPerson(p.x + 28 * s, p.y + 1 * s, s * 0.8, "#e2b56d", Math.cos(t * 0.006) * 0.7);

  ctx.restore();
};

const drawLanternViewingScene = (p, t) => {
  const s = p.scale;
  const twinkle = 0.72 + Math.sin(t * 0.004 + p.relZ * 0.1) * 0.27;

  ctx.save();
  ctx.globalAlpha = p.alpha;

  drawLanternGlow(p.x, p.y - 26 * s, 11.5 * s, twinkle * p.alpha);
  ctx.fillStyle = "#d54f35";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 26 * s, 8.6 * s, 11.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  drawPerson(p.x - 13 * s, p.y + 1 * s, s * 0.84, "#ffd29f", Math.sin(t * 0.004) * 0.6);
  drawPerson(p.x + 14 * s, p.y + 2 * s, s * 0.86, "#f7bf89", Math.cos(t * 0.004) * 0.6);

  ctx.restore();
};

const drawDragonDanceScene = (p, t) => {
  const s = p.scale;
  const segments = 9;
  const base = t * 0.006;

  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.lineCap = "round";

  for (let i = 0; i < segments; i += 1) {
    const progress = i / (segments - 1);
    const x = p.x - 32 * s + progress * 64 * s;
    const y = p.y - 14 * s + Math.sin(base * 2 + i * 0.75) * 8.5 * s;
    const r = (7.8 - i * 0.55) * s;

    drawLanternGlow(x, y, r * 0.9, p.alpha * 0.78);
    ctx.fillStyle = i === 0 ? "#f8c85b" : i % 2 === 0 ? "#c83427" : "#e1542d";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255, 228, 176, 0.62)";
  ctx.lineWidth = Math.max(1, 1.6 * s);
  ctx.beginPath();
  for (let i = 0; i < segments; i += 1) {
    const progress = i / (segments - 1);
    const x = p.x - 32 * s + progress * 64 * s;
    const y = p.y - 14 * s + Math.sin(base * 2 + i * 0.75) * 8.5 * s;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  ctx.restore();
};

const drawLionDanceScene = (p, t) => {
  const s = p.scale;
  const bounce = Math.abs(Math.sin(t * 0.006 + p.relZ * 0.08));

  ctx.save();
  ctx.globalAlpha = p.alpha;

  const headY = p.y - 12 * s - bounce * 6.5 * s;
  drawLanternGlow(p.x - 9 * s, headY, 8.3 * s, p.alpha * 0.84);

  ctx.fillStyle = "#f4c05a";
  ctx.beginPath();
  ctx.arc(p.x - 9 * s, headY, 8.1 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#bc2f27";
  ctx.beginPath();
  ctx.ellipse(p.x + 7 * s, p.y - 8 * s - bounce * 3.1 * s, 11.4 * s, 7.2 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  drawPerson(p.x - 2 * s, p.y + 1 * s, s * 0.82, "#f5c18e", Math.sin(t * 0.005) * 0.5);

  ctx.restore();
};

const drawStiltScene = (p, t) => {
  const s = p.scale;
  const sway = Math.sin(t * 0.005 + p.relZ * 0.04);

  ctx.save();
  ctx.globalAlpha = p.alpha;

  drawPerson(p.x - 8 * s + sway * 2.2 * s, p.y + 7 * s, s * 0.81, "#f8d2a2", sway, 1.75);
  drawPerson(p.x + 11 * s - sway * 1.8 * s, p.y + 6 * s, s * 0.79, "#efbf8a", -sway, 1.7);

  ctx.strokeStyle = "#7f4a2a";
  ctx.lineWidth = Math.max(1, 1.6 * s);
  ctx.beginPath();
  ctx.moveTo(p.x - 8 * s + sway * 2 * s, p.y + 5 * s);
  ctx.lineTo(p.x - 8 * s + sway * 2 * s, p.y + 17 * s);
  ctx.moveTo(p.x + 11 * s - sway * 2 * s, p.y + 5 * s);
  ctx.lineTo(p.x + 11 * s - sway * 2 * s, p.y + 17 * s);
  ctx.stroke();

  ctx.restore();
};

const drawYanggeScene = (p, t) => {
  const s = p.scale;

  ctx.save();
  ctx.globalAlpha = p.alpha;

  for (let i = 0; i < 3; i += 1) {
    const phase = t * 0.005 + i * 0.9 + p.relZ * 0.02;
    const x = p.x + (i - 1) * 13 * s;
    const y = p.y + Math.sin(phase) * 2.3 * s;
    const swing = Math.sin(phase) * 1.2;

    drawPerson(x, y, s * 0.79, "#ffcf93", swing);

    ctx.fillStyle = i % 2 === 0 ? "#d9412f" : "#f5c35d";
    ctx.beginPath();
    ctx.ellipse(x + 5 * s, y - 9 * s, 4.4 * s, 2.2 * s, swing * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

const drawTangyuanScene = (p, t) => {
  const s = p.scale;

  ctx.save();
  ctx.globalAlpha = p.alpha;

  ctx.fillStyle = "#70412d";
  ctx.fillRect(p.x - 19 * s, p.y - 8.5 * s, 38 * s, 10.5 * s);

  ctx.fillStyle = "#f6d7a2";
  ctx.beginPath();
  ctx.arc(p.x, p.y - 9.4 * s, 7.2 * s, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 3; i += 1) {
    const steam = mod(t * 0.0012 + i * 0.26, 1);
    ctx.strokeStyle = `rgba(255, 244, 217, ${(1 - steam) * 0.55})`;
    ctx.lineWidth = Math.max(1, 0.72 * s);
    ctx.beginPath();
    ctx.moveTo(p.x - 2 * s + i * 2 * s, p.y - 12.5 * s);
    ctx.quadraticCurveTo(
      p.x - 5 * s + i * 3 * s,
      p.y - 20 * s - steam * 8.5 * s,
      p.x - 1 * s + i * 2 * s,
      p.y - 27 * s - steam * 10.5 * s,
    );
    ctx.stroke();
  }

  drawPerson(p.x - 12 * s, p.y + 2 * s, s * 0.74, "#ffd7ab", Math.sin(t * 0.004) * 0.4);
  drawPerson(p.x + 14 * s, p.y + 2 * s, s * 0.74, "#f6c28e", Math.cos(t * 0.004) * 0.4);

  ctx.restore();
};

const drawAction = (entity, p, t) => {
  switch (entity.actionType) {
    case "riddle":
      drawRiddleScene(p, t);
      break;
    case "lantern":
      drawLanternViewingScene(p, t);
      break;
    case "dragon":
      drawDragonDanceScene(p, t);
      break;
    case "lion":
      drawLionDanceScene(p, t);
      break;
    case "stilts":
      drawStiltScene(p, t);
      break;
    case "yangge":
      drawYanggeScene(p, t);
      break;
    case "tangyuan":
      drawTangyuanScene(p, t);
      break;
    default:
      break;
  }
};

const drawLanternStrings = (t) => {
  const rows = 4;
  const columns = Math.ceil(width / 88) + 3;
  const swayBase = Math.sin(t * 0.0018) * 9;

  for (let row = 0; row < rows; row += 1) {
    const y = horizonY - 96 + row * 31 + swayBase * (0.12 + row * 0.08);
    const amp = 7 + row * 2;

    ctx.strokeStyle = "rgba(130, 90, 44, 0.74)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < columns; i += 1) {
      const x = i * 88 - mod(travel * (12 + row * 3), 88);
      const wave = Math.sin(i * 0.48 + t * 0.0014 + row) * amp;
      if (i === 0) {
        ctx.moveTo(x, y + wave);
      } else {
        ctx.lineTo(x, y + wave);
      }
    }
    ctx.stroke();

    for (let i = 0; i < columns; i += 1) {
      const x = i * 88 - mod(travel * (12 + row * 3), 88);
      const wave = Math.sin(i * 0.48 + t * 0.0014 + row) * amp;
      const twinkle = 0.6 + Math.sin(t * 0.003 + i + row * 2.1) * 0.27;
      drawLanternGlow(x, y + wave + 10, 5 + row * 0.9, twinkle);

      ctx.fillStyle = row % 2 === 0 ? "#d84232" : "#f0b650";
      ctx.beginPath();
      ctx.ellipse(x, y + wave + 10, 4 + row * 0.9, 5 + row * 1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

const drawForegroundLanterns = (t) => {
  if (prefersReduced) {
    return;
  }

  foregroundLanterns.forEach((item, index) => {
    const band = (index % 3) / 3;
    const x = width * (item.side === -1 ? 0.08 + item.laneShift * 0.08 : 0.92 - item.laneShift * 0.08);
    const y = height * item.yOffset + Math.sin(t * 0.0014 * item.sway + item.seed) * 9;
    const radius = item.size * (0.7 + band * 0.5);
    const flicker = 0.7 + Math.sin(t * 0.003 + index) * 0.2;

    drawLanternGlow(x, y, radius * 0.36, flicker * 0.8);
    ctx.fillStyle = item.side === -1 ? "rgba(215, 62, 46, 0.34)" : "rgba(236, 163, 77, 0.26)";
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 0.32, radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  });
};

const drawParticles = (t) => {
  if (prefersReduced) {
    return;
  }

  particles.forEach((particle) => {
    const x = mod(particle.x + t * 0.000016 * particle.speed + Math.sin(t * 0.0006 + particle.seed) * 0.005, 1);
    const y = mod(particle.y + t * 0.000028 * particle.speed, 1);
    const px = x * width;
    const py = y * height;
    const alpha = 0.1 + (1 - y) * 0.45;

    ctx.fillStyle = particle.warm ? `rgba(255, 214, 145, ${alpha})` : `rgba(191, 202, 255, ${alpha * 0.75})`;
    ctx.beginPath();
    ctx.arc(px, py, particle.size, 0, Math.PI * 2);
    ctx.fill();
  });
};

const drawStreetEntities = (t) => {
  const drawQueue = [];

  streetEntities.forEach((entity) => {
    const p = project(entity.x, entity.z);
    if (!p) {
      return;
    }

    drawQueue.push({ entity, p });
  });

  drawQueue.sort((a, b) => b.p.relZ - a.p.relZ);

  drawQueue.forEach(({ entity, p }) => {
    if (entity.kind === "stall") {
      drawStall(entity, p, t);
      return;
    }

    if (entity.kind === "lanternPost") {
      drawLanternPost(entity, p, t);
      return;
    }

    if (entity.kind === "archway") {
      drawArchway(p, t);
      return;
    }

    if (entity.kind === "banner") {
      drawBanner(entity, p, t);
      return;
    }

    if (entity.kind === "crowd") {
      drawCrowd(entity, p, t);
      return;
    }

    if (entity.kind === "action") {
      drawAction(entity, p, t);
    }
  });
};

const drawColorGrade = (t) => {
  const warmth = 0.08 + framePulse * 0.08;
  ctx.fillStyle = `rgba(255, 141, 52, ${warmth})`;
  ctx.fillRect(0, 0, width, height);

  const cool = 0.05 + Math.sin(t * 0.0009) * 0.02;
  ctx.fillStyle = `rgba(66, 84, 180, ${cool})`;
  ctx.fillRect(0, 0, width, height * 0.6);
};

const findCurrentScene = () => {
  let nearest = null;

  streetEntities.forEach((entity) => {
    if (entity.kind !== "action") {
      return;
    }

    const relZ = mod(entity.z - travel, routeLength);
    if (relZ < nearZ || relZ > 110) {
      return;
    }

    if (!nearest || relZ < nearest.relZ) {
      nearest = { relZ, actionType: entity.actionType };
    }
  });

  return nearest ? sceneLabelMap[nearest.actionType] : "灯火初上";
};

const draw = (t) => {
  drawSky(t);
  drawBackgroundBuildings(t);
  drawRoad(t);
  drawLanternStrings(t);
  drawStreetEntities(t);
  drawParticles(t);
  drawForegroundLanterns(t);
  drawColorGrade(t);
};

const updateHud = () => {
  const absSpeed = Math.abs(baseSpeed + velocity);

  if (absSpeed < 0.18) {
    speedValue.textContent = "慢游";
  } else if (absSpeed < 0.42) {
    speedValue.textContent = "平缓";
  } else if (absSpeed < 0.76) {
    speedValue.textContent = "热闹";
  } else {
    speedValue.textContent = "疾行";
  }

  sceneValue.textContent = findCurrentScene();
};

const onWheel = (event) => {
  event.preventDefault();
  velocity += clamp(event.deltaY * 0.0019, -0.95, 0.95);
  hasInteracted = true;
  hintText.textContent = "继续滚轮可前后漫游整条花街。";
};

const onTouchStart = (event) => {
  if (event.touches.length >= 2) {
    pinchDistancePrev = getTouchDistance(event.touches[0], event.touches[1]);
    hasInteracted = true;
    hintText.textContent = "双指可缩放场景，上下滑动可漫游花街。";
    return;
  }

  if (event.touches.length < 1) {
    return;
  }

  pinchDistancePrev = null;
  touchY = event.touches[0].clientY;
};

const onTouchMove = (event) => {
  if (event.touches.length >= 2) {
    event.preventDefault();
    const currentDistance = getTouchDistance(event.touches[0], event.touches[1]);

    if (pinchDistancePrev) {
      const zoomRatio = currentDistance / pinchDistancePrev;
      userZoom = clamp(userZoom * zoomRatio, 0.7, 1.9);
    }

    pinchDistancePrev = currentDistance;
    hasInteracted = true;
    hintText.textContent = "双指缩放中：可放大/缩小花街。";
    return;
  }

  if (event.touches.length < 1) {
    return;
  }

  pinchDistancePrev = null;
  const y = event.touches[0].clientY;
  const delta = touchY - y;
  touchY = y;

  velocity += clamp(delta * 0.012, -0.8, 0.8);
  hasInteracted = true;
  hintText.textContent = "继续上下滑动可前后漫游花街。";
};

const onTouchEnd = (event) => {
  if (event.touches.length < 2) {
    pinchDistancePrev = null;
  }

  if (event.touches.length === 1) {
    touchY = event.touches[0].clientY;
  }
};

const onKeyDown = (event) => {
  if (event.key === "ArrowDown") {
    velocity += 0.12;
  }
  if (event.key === "ArrowUp") {
    velocity -= 0.12;
  }
};

let lastTime = performance.now();

const tick = (now) => {
  const dt = Math.min(42, now - lastTime);
  lastTime = now;

  velocity = clamp(velocity, -1.5, 1.5);
  velocity *= Math.pow(0.93, dt / 16.67);

  const energy = clamp(Math.abs(baseSpeed + velocity), 0, 1.4);
  framePulse = prefersReduced ? 0.2 : 0.35 + Math.sin(now * 0.0042) * 0.3;
  frameSwing = prefersReduced ? 0 : Math.sin(now * 0.0008) * (0.2 + energy * 0.22);
  frameZoom = 1 + (prefersReduced ? 0 : energy * 0.05 + Math.sin(now * 0.0011) * 0.012);

  const cameraSway = prefersReduced ? 0 : Math.sin(now * 0.00065) * 0.016;
  const move = (baseSpeed + velocity + cameraSway) * dt * 0.92 * movementScale;
  travel += move;

  draw(now);
  updateHud();

  if (!hasInteracted) {
    hintText.textContent = "滚轮向下前行，向上回退；移动端上下滑动可漫游。";
  }

  requestAnimationFrame(tick);
};

const init = () => {
  resize();
  buildWorld();

  window.addEventListener("resize", resize);
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });
  window.addEventListener("keydown", onKeyDown);

  requestAnimationFrame(tick);
};

init();
