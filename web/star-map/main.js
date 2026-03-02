import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const DEFAULT_POST_ID = "1fda6830-1198-4c1f-8725-bfdbbd0f3f45";
const API_BASE = "https://www.moltbook.com/api/v1";
const MILESTONES = [10, 20, 30, 40, 50];

const state = {
  postId: DEFAULT_POST_ID,
  mode: "3d",
  refreshTimer: null,
  starMeshes: [],
  validEntries: [],
};

const refs = {
  postIdInput: document.getElementById("postIdInput"),
  applyPostBtn: document.getElementById("applyPostBtn"),
  toggleModeBtn: document.getElementById("toggleModeBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  langCount: document.getElementById("langCount"),
  countryCount: document.getElementById("countryCount"),
  starCount: document.getElementById("starCount"),
  langBar: document.getElementById("langBar"),
  countryBar: document.getElementById("countryBar"),
  starBar: document.getElementById("starBar"),
  milestones: document.getElementById("milestones"),
  nextTarget: document.getElementById("nextTarget"),
  lastUpdated: document.getElementById("lastUpdated"),
  canvasWrap: document.getElementById("canvasWrap"),
  starTooltip: document.getElementById("starTooltip"),
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
refs.canvasWrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x090b1d, 0.028);

const perspectiveCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 180);
perspectiveCamera.position.set(0, 4.5, 19);

const orthoCamera = new THREE.OrthographicCamera(-16, 16, 12, -12, 0.1, 180);
orthoCamera.position.set(0, 0, 28);
orthoCamera.lookAt(0, 0, 0);

let activeCamera = perspectiveCamera;

const controls3d = new OrbitControls(perspectiveCamera, renderer.domElement);
controls3d.enableDamping = true;
controls3d.dampingFactor = 0.06;
controls3d.minDistance = 9;
controls3d.maxDistance = 40;

const controls2d = new OrbitControls(orthoCamera, renderer.domElement);
controls2d.enableDamping = true;
controls2d.dampingFactor = 0.06;
controls2d.enableRotate = false;
controls2d.minZoom = 0.7;
controls2d.maxZoom = 3.5;
controls2d.enabled = false;

let activeControls = controls3d;

const starLayer = new THREE.Group();
const lineLayer = new THREE.Group();
scene.add(starLayer);
scene.add(lineLayer);

initSceneDecor();
setInitialPostId();
bindUI();
resize();
fetchAndRender();
animate();

function bindUI() {
  refs.applyPostBtn.addEventListener("click", () => {
    const raw = refs.postIdInput.value.trim();
    if (!raw) {
      return;
    }
    state.postId = raw;
    syncUrl();
    fetchAndRender();
  });

  refs.refreshBtn.addEventListener("click", () => {
    fetchAndRender();
  });

  refs.toggleModeBtn.addEventListener("click", () => {
    setMode(state.mode === "3d" ? "2d" : "3d");
  });

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", () => {
    refs.starTooltip.hidden = true;
  });

  window.addEventListener("resize", resize);
}

function setInitialPostId() {
  const url = new URL(window.location.href);
  const idFromQuery = url.searchParams.get("postId");
  if (idFromQuery) {
    state.postId = idFromQuery;
  }
  refs.postIdInput.value = state.postId;
}

function syncUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("postId", state.postId);
  window.history.replaceState({}, "", url.toString());
}

function setMode(mode) {
  state.mode = mode;

  if (mode === "2d") {
    activeCamera = orthoCamera;
    controls3d.enabled = false;
    controls2d.enabled = true;
    activeControls = controls2d;
    refs.toggleModeBtn.textContent = "切到 3D";
    refs.toggleModeBtn.setAttribute("aria-label", "switch to 3d");
  } else {
    activeCamera = perspectiveCamera;
    controls2d.enabled = false;
    controls3d.enabled = true;
    activeControls = controls3d;
    refs.toggleModeBtn.textContent = "切到 2D";
    refs.toggleModeBtn.setAttribute("aria-label", "switch to 2d");
  }

  updateStarPositions(state.validEntries);
  resize();
}

async function fetchAndRender() {
  refs.lastUpdated.textContent = "最后更新：获取中...";

  try {
    const [postRes, commentsRes] = await Promise.all([
      fetch(`${API_BASE}/posts/${state.postId}`),
      fetch(`${API_BASE}/posts/${state.postId}/comments?sort=new`),
    ]);

    if (!postRes.ok || !commentsRes.ok) {
      throw new Error(`HTTP ${postRes.status}/${commentsRes.status}`);
    }

    const postJson = await postRes.json();
    const commentsJson = await commentsRes.json();
    const post = postJson.post || {};
    const comments = flattenComments(commentsJson.comments || []);

    const validEntries = comments
      .map((comment) => parseEntry(comment))
      .filter((entry) => entry !== null);

    state.validEntries = validEntries;

    const uniqueLanguages = new Set(validEntries.map((item) => item.languageKey));
    const uniqueCountries = new Set(validEntries.map((item) => item.countryKey));

    updateStats({
      languageCount: uniqueLanguages.size,
      countryCount: uniqueCountries.size,
      starCount: validEntries.length,
      updatedAt: post.updated_at,
    });

    updateMilestones(uniqueLanguages.size);
    rebuildStars(validEntries);

    refs.lastUpdated.textContent = `最后更新：${formatTime(post.updated_at || new Date().toISOString())}`;

    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(fetchAndRender, 60_000);
  } catch (error) {
    refs.lastUpdated.textContent = `最后更新：请求失败（${String(error.message || error)}）`;
    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(fetchAndRender, 75_000);
  }
}

function flattenComments(comments) {
  const output = [];

  const walk = (comment) => {
    output.push(comment);
    if (Array.isArray(comment.replies)) {
      comment.replies.forEach(walk);
    }
  };

  comments.forEach(walk);

  return output.sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return ta - tb;
  });
}

function parseEntry(comment) {
  const content = comment.content || "";
  const lineMatch = content.match(/\[?\s*([^|\]\n]{2,50})\s*\|\s*([^\]\n]{2,50})\s*\]?/);
  const hasChinese = /[\u4e00-\u9fff]/.test(content);

  if (!lineMatch || !hasChinese) {
    return null;
  }

  const country = sanitizeToken(lineMatch[1]);
  const language = sanitizeToken(lineMatch[2]);

  if (!country || !language) {
    return null;
  }

  return {
    id: comment.id,
    createdAt: comment.created_at,
    author: comment.author?.name || "unknown",
    content,
    country,
    language,
    countryKey: country.toLowerCase(),
    languageKey: language.toLowerCase(),
  };
}

function sanitizeToken(raw) {
  return String(raw || "")
    .replace(/[`*_~<>]/g, "")
    .trim();
}

function updateStats({ languageCount, countryCount, starCount }) {
  refs.langCount.textContent = String(languageCount);
  refs.countryCount.textContent = String(countryCount);
  refs.starCount.textContent = String(starCount);

  refs.langBar.style.width = `${Math.min((languageCount / 50) * 100, 100)}%`;
  refs.countryBar.style.width = `${Math.min((countryCount / 50) * 100, 100)}%`;
  refs.starBar.style.width = `${Math.min((starCount / 50) * 100, 100)}%`;

  const next = MILESTONES.find((target) => languageCount < target);
  refs.nextTarget.textContent = next ? `下一里程碑：${next} 语言` : "已达成 50 语言终点";
}

function updateMilestones(languageCount) {
  refs.milestones.innerHTML = "";

  const labels = {
    10: "10 种语言：点亮第一圈星轨",
    20: "20 种语言：发布幸福关键词云",
    30: "30 种语言：做一版短诗拼贴",
    40: "40 种语言：做跨文化甜蜜词典",
    50: "50 种语言：完成世界星图终版",
  };

  MILESTONES.forEach((value) => {
    const li = document.createElement("li");
    li.textContent = labels[value];
    if (languageCount >= value) {
      li.classList.add("done");
    }
    refs.milestones.appendChild(li);
  });
}

function initSceneDecor() {
  const ambient = new THREE.AmbientLight(0xadc9ff, 0.85);
  const keyLight = new THREE.PointLight(0xfcb6ff, 1.45, 70, 2);
  const rimLight = new THREE.PointLight(0x93c7ff, 1.2, 90, 2);

  keyLight.position.set(-10, 9, 6);
  rimLight.position.set(8, -5, 14);

  scene.add(ambient, keyLight, rimLight);

  const farStarsGeo = new THREE.BufferGeometry();
  const farStars = [];

  for (let i = 0; i < 1800; i += 1) {
    const r = 80 + Math.random() * 80;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    farStars.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    );
  }

  farStarsGeo.setAttribute("position", new THREE.Float32BufferAttribute(farStars, 3));

  const farStarsMat = new THREE.PointsMaterial({
    color: 0xf7f8ff,
    size: 0.08,
    transparent: true,
    opacity: 0.75,
  });

  const farStarsMesh = new THREE.Points(farStarsGeo, farStarsMat);
  scene.add(farStarsMesh);
}

function rebuildStars(entries) {
  clearGroup(starLayer);
  clearGroup(lineLayer);
  state.starMeshes = [];

  entries.forEach((entry, index) => {
    const { p3, p2 } = buildDeterministicPosition(entry, index, entries.length || 1);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 20, 20),
      new THREE.MeshBasicMaterial({
        color: colorForToken(entry.languageKey),
      }),
    );

    mesh.userData = { entry, p3, p2 };
    starLayer.add(mesh);
    state.starMeshes.push(mesh);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 18, 18),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.08,
      }),
    );
    mesh.add(glow);
  });

  buildConstellationLines();
  updateStarPositions(entries);
}

function updateStarPositions(entries) {
  const activeMode = state.mode;

  state.starMeshes.forEach((mesh) => {
    const target = activeMode === "3d" ? mesh.userData.p3 : mesh.userData.p2;
    mesh.position.copy(target);
  });

  buildConstellationLines();

  if (activeMode === "3d") {
    starLayer.rotation.y = 0.22;
  } else {
    starLayer.rotation.y = 0;
  }

  if (!entries.length) {
    return;
  }
}

function buildConstellationLines() {
  clearGroup(lineLayer);

  if (state.starMeshes.length < 2) {
    return;
  }

  const positions = [];

  state.starMeshes.forEach((mesh, index) => {
    const current = mesh.position;
    let nearestIndex = -1;
    let nearestDist = Infinity;

    state.starMeshes.forEach((other, otherIndex) => {
      if (index === otherIndex) {
        return;
      }
      const dist = current.distanceToSquared(other.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = otherIndex;
      }
    });

    if (nearestIndex >= 0 && nearestIndex > index) {
      const other = state.starMeshes[nearestIndex];
      positions.push(
        current.x,
        current.y,
        current.z,
        other.position.x,
        other.position.y,
        other.position.z,
      );
    }
  });

  if (!positions.length) {
    return;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  const mat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: state.mode === "3d" ? 0.2 : 0.26,
  });

  lineLayer.add(new THREE.LineSegments(geo, mat));
}

function buildDeterministicPosition(entry, index, total) {
  const key = `${entry.languageKey}-${entry.countryKey}`;
  const seed = hashString(key);

  const u = ((seed % 997) + 1) / 998;
  const v = (((seed / 997) % 991) + 1) / 992;

  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const radius = 8.8 + ((seed % 17) - 8) * 0.08;

  const p3 = new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
  );

  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  const spiralR = 2.8 + 0.45 * Math.sqrt(index + 1);
  const p2 = new THREE.Vector3(Math.cos(angle) * spiralR, Math.sin(angle) * spiralR, 0);

  return { p3, p2 };
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function colorForToken(token) {
  const palette = [0xf7a7ff, 0x8fc4ff, 0xb6ffd9, 0xffd8a8, 0xd2bcff];
  return palette[hashString(token) % palette.length];
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function onPointerMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, activeCamera);
  const intersections = raycaster.intersectObjects(state.starMeshes, false);

  if (!intersections.length) {
    refs.starTooltip.hidden = true;
    return;
  }

  const hit = intersections[0].object;
  const entry = hit.userData.entry;

  refs.starTooltip.hidden = false;
  refs.starTooltip.style.left = `${event.clientX}px`;
  refs.starTooltip.style.top = `${event.clientY}px`;
  refs.starTooltip.innerHTML = [
    `<strong>${escapeHtml(entry.country)} | ${escapeHtml(entry.language)}</strong>`,
    `<div>by @${escapeHtml(entry.author)}</div>`,
    `<div>${escapeHtml(formatTime(entry.createdAt))}</div>`,
  ].join("");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clearGroup(group) {
  for (let i = group.children.length - 1; i >= 0; i -= 1) {
    const child = group.children[i];
    group.remove(child);

    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((item) => item.dispose());
      } else {
        child.material.dispose();
      }
    }
  }
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "--";
  }
  return d.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resize() {
  const width = refs.canvasWrap.clientWidth;
  const height = refs.canvasWrap.clientHeight;
  renderer.setSize(width, height, false);

  perspectiveCamera.aspect = width / height;
  perspectiveCamera.updateProjectionMatrix();

  const ratio = width / height;
  const base = 12;
  orthoCamera.left = -base * ratio;
  orthoCamera.right = base * ratio;
  orthoCamera.top = base;
  orthoCamera.bottom = -base;
  orthoCamera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);

  activeControls.update();

  if (state.mode === "3d") {
    starLayer.rotation.y += 0.0008;
  }

  renderer.render(scene, activeCamera);
}
