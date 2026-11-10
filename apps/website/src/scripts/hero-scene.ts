import {
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  DynamicDrawUsage,
  Group,
  MathUtils,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from "three";

type Mode = "desktop" | "mobile";

type Simulation = {
  geometry: BufferGeometry;
  alive: Uint8Array;
  next: Uint8Array;
  aliveAttribute: BufferAttribute;
  step: () => void;
};

const CAM_Z = 8;
const RULE_BIRTH = 5;
const RULE_SURVIVE = new Set([4, 5, 6]);
const GENERATION_INTERVAL = 0.22;

const CONFIG = {
  desktop: {
    grid: 27,
    diameter: 3.45,
    fill: 0.92,
    sizeFactor: 0.008,
    spin: { y: 0.105, x: 0.045 },
    generationInterval: GENERATION_INTERVAL,
  },
  mobile: {
    grid: 19,
    diameter: 3.25,
    fill: 0.88,
    sizeFactor: 0.009,
    spin: { y: 0.16, x: 0.035 },
    generationInterval: GENERATION_INTERVAL * 1.25,
  },
} satisfies Record<Mode, unknown>;

/** Small deterministic PRNG. A URL seed reproduces the same initial organism. */
function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getSeed(): number {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("seed");
  if (fromUrl && /^\d+$/.test(fromUrl)) return Number(fromUrl) >>> 0;
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/**
 * 3D Conway-style cellular automaton using the 26-cell Moore neighborhood.
 * Rule B5/S456: a dead cell is born with 5 neighbors; a live cell survives
 * with 4, 5, or 6 neighbors. This rule keeps the seeded structure evolving longer.
 */
function createLife(grid: number, seed: number): Simulation {
  const count = grid * grid * grid;
  const position = new Float32Array(count * 3);
  const alive = new Uint8Array(count);
  const next = new Uint8Array(count);
  const aliveValues = new Float32Array(count);
  const rand = mulberry32(seed);
  const half = (grid - 1) / 2;
  const spacing = 3 / (grid - 1);
  const center = (grid - 1) / 2;
  const radius = grid * 0.39;

  // Seed a soft spherical volume rather than filling the entire cube.
  for (let z = 0; z < grid; z++) {
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const index = x + y * grid + z * grid * grid;
        const px = (x - half) * spacing;
        const py = (y - half) * spacing;
        const pz = (z - half) * spacing;
        const distance = Math.sqrt((x - center) ** 2 + (y - center) ** 2 + (z - center) ** 2);
        const falloff = Math.max(0, 1 - distance / radius);
        const probability = 0.12 + falloff * 0.2;

        position.set([px, py, pz], index * 3);
        alive[index] = distance < radius && rand() < probability ? 1 : 0;
        aliveValues[index] = alive[index];
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  const aliveAttribute = new BufferAttribute(aliveValues, 1);
  aliveAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("aAlive", aliveAttribute);

  const step = () => {
    for (let z = 0; z < grid; z++) {
      for (let y = 0; y < grid; y++) {
        for (let x = 0; x < grid; x++) {
          const index = x + y * grid + z * grid * grid;
          let neighbors = 0;

          for (let dz = -1; dz <= 1; dz++) {
            const nz = z + dz;
            if (nz < 0 || nz >= grid) continue;
            for (let dy = -1; dy <= 1; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= grid) continue;
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0 && dz === 0) continue;
                const nx = x + dx;
                if (nx < 0 || nx >= grid) continue;
                neighbors += alive[nx + ny * grid + nz * grid * grid];
              }
            }
          }

          next[index] = alive[index]
            ? Number(RULE_SURVIVE.has(neighbors))
            : Number(neighbors === RULE_BIRTH);
        }
      }
    }

    alive.set(next);
    for (let i = 0; i < count; i++) aliveValues[i] = alive[i];
    aliveAttribute.needsUpdate = true;
  };

  return { geometry, alive, next, aliveAttribute, step };
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;
  uniform float uPixelRatio;
  uniform float uCamDist;
  uniform float uStrength;
  uniform vec2 uMouse;
  attribute float aAlive;
  varying float vAlpha;
  varying float vAlive;
  varying float vAccent;

  void main() {
    vAlive = aAlive;
    if (aAlive < 0.5) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      vAccent = 0.0;
      return;
    }

    vec3 p = position;
    float phase = dot(position, vec3(2.1, 2.8, 1.7));
    float breathe = sin(uTime * 1.05 + phase) * 0.035;
    p += normalize(position + vec3(0.0001)) * breathe;

    vec4 world = modelMatrix * vec4(p, 1.0);
    vec2 diff = world.xy - uMouse;
    float radius = max(0.001, 1.45 * uScale);
    float push = (1.0 - smoothstep(0.0, radius, length(diff))) * uStrength;
    world.xy += normalize(diff + vec2(0.0001)) * push * 0.32 * uScale;
    world.z += push * 0.42 * uScale;

    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (0.72 + fract(phase * 0.37) * 0.65)
      * (1.0 + push * 0.75) * (uCamDist / max(0.1, -mv.z));

    float depth = (-mv.z - uCamDist) / (1.8 * uScale);
    vAlpha = mix(0.34, 1.0, clamp(1.0 - depth * 0.5, 0.0, 1.0));
    vAccent = step(0.82, fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uAccent;
  varying float vAlpha;
  varying float vAlive;
  varying float vAccent;

  void main() {
    if (vAlive < 0.5) discard;
    float radius = length(gl_PointCoord - 0.5);
    if (radius > 0.5) discard;
    float core = smoothstep(0.5, 0.12, radius);
    float halo = smoothstep(0.5, 0.28, radius) * 0.22;
    vec3 color = mix(uBase, uAccent, vAccent);
    gl_FragColor = vec4(color, (core + halo) * vAlpha);
    #include <colorspace_fragment>
  }
`;

function readThemeColor(variable: string, fallback: string): Color {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  // --black is stored as RGB channels in the existing global.css.
  return variable === "--black"
    ? new Color(`rgb(${value || "84, 36, 58"})`)
    : new Color(value || fallback);
}

function mount(mode: Mode, seed: number): (() => void) | undefined {
  const wrap = document.querySelector<HTMLElement>("[data-scene]");
  const anchor = document.querySelector<HTMLElement>("[data-scene-anchor]");
  if (!wrap || !anchor) return;

  const cfg = CONFIG[mode];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const useGhost = matchMedia("(hover: none)").matches;
  const abort = new AbortController();
  const { signal } = abort;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.className = "block h-full w-full";
  wrap.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = CAM_Z;

  const simulation = createLife(cfg.grid, seed);
  const geometry = simulation.geometry;
  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: 3 },
    uScale: { value: 1 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uCamDist: { value: CAM_Z },
    uStrength: { value: 0 },
    uMouse: { value: new Vector2() },
    uBase: { value: readThemeColor("--black", "#54243a") },
    uAccent: { value: readThemeColor("--accent", "#d92e70") },
  };

  const material = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });

  const group = new Group();
  group.add(new Points(geometry, material));
  scene.add(group);

  let worldPerPixel = 1;
  let scale = 1;
  const layout = () => {
    const rect = wrap.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();

    const worldH = 2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * CAM_Z;
    worldPerPixel = worldH / rect.height;
    scale = (anchorRect.width * worldPerPixel * cfg.fill) / cfg.diameter;
    group.scale.setScalar(scale);
    group.position.set(
      (anchorRect.left + anchorRect.width / 2 - (rect.left + rect.width / 2)) * worldPerPixel,
      -(anchorRect.top + anchorRect.height / 2 - (rect.top + rect.height / 2)) * worldPerPixel,
      0,
    );

    uniforms.uScale.value = scale;
    uniforms.uSize.value = Math.max(2, anchorRect.width * cfg.sizeFactor);
    renderer.render(scene, camera);
  };

  const resizeObserver = new ResizeObserver(layout);
  resizeObserver.observe(wrap);
  resizeObserver.observe(anchor);
  layout();

  const pointerWorld = new Vector2();
  const mouse = new Vector2();
  let pointerActive = false;
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  let dragRotY = 0;
  let dragVel = 0;
  let dragging = false;
  let lastX = 0;

  const toWorld = (clientX: number, clientY: number) => {
    const rect = wrap.getBoundingClientRect();
    pointerWorld.set(
      (clientX - (rect.left + rect.width / 2)) * worldPerPixel,
      -(clientY - (rect.top + rect.height / 2)) * worldPerPixel,
    );
  };

  addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return;
      toWorld(event.clientX, event.clientY);
      pointerActive = true;
      tilt.tx = (event.clientX / innerWidth - 0.5) * 2;
      tilt.ty = (event.clientY / innerHeight - 0.5) * 2;
    },
    { signal },
  );

  document.documentElement.addEventListener(
    "pointerleave",
    () => {
      pointerActive = false;
      tilt.tx = tilt.ty = 0;
    },
    { signal },
  );

  anchor.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse") return;
      dragging = true;
      pointerActive = true;
      lastX = event.clientX;
      toWorld(event.clientX, event.clientY);
    },
    { signal },
  );

  anchor.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "mouse" || !dragging) return;
      toWorld(event.clientX, event.clientY);
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      dragVel = dx * 0.01;
      dragRotY += dragVel;
    },
    { signal },
  );

  const endDrag = () => {
    dragging = false;
    pointerActive = false;
  };
  anchor.addEventListener("pointerup", endDrag, { signal });
  anchor.addEventListener("pointercancel", endDrag, { signal });

  let visible = true;
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  intersectionObserver.observe(wrap);

  const clock = new Clock();
  let raf = 0;
  let generationAccumulator = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;

    const delta = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    uniforms.uTime.value = time;

    generationAccumulator += delta;
    if (generationAccumulator >= cfg.generationInterval) {
      simulation.step();
      generationAccumulator %= cfg.generationInterval;
    }

    let targetStrength = 0;
    const target = pointerWorld.clone();
    if (pointerActive) {
      targetStrength = 1;
    } else if (useGhost) {
      const radius = (cfg.diameter / 2) * scale;
      target.set(
        group.position.x + Math.cos(time * 0.75) * 0.42 * radius,
        group.position.y + Math.sin(time * 1.05) * 0.36 * radius,
      );
      targetStrength = 0.7;
    }

    if (uniforms.uStrength.value < 0.02) mouse.copy(target);
    else mouse.lerp(target, 0.15);
    uniforms.uMouse.value.copy(mouse);
    uniforms.uStrength.value += (targetStrength - uniforms.uStrength.value) * 0.08;

    tilt.x += (tilt.tx - tilt.x) * 0.05;
    tilt.y += (tilt.ty - tilt.y) * 0.05;
    if (!dragging) {
      dragRotY += dragVel;
      dragVel *= 0.94;
    }

    group.rotation.y = time * cfg.spin.y + tilt.x * 0.35 + dragRotY;
    group.rotation.x = time * cfg.spin.x + tilt.y * 0.25;
    renderer.render(scene, camera);
  };

  if (!reduceMotion) tick();

  return () => {
    cancelAnimationFrame(raf);
    abort.abort();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

/** Mount the same seeded 3D life system on desktop and mobile. */
export function initHeroScene() {
  const mediaQuery = matchMedia("(max-width: 767px)");
  const seed = getSeed();
  let cleanup = mount(mediaQuery.matches ? "mobile" : "desktop", seed);

  const onModeChange = (event: MediaQueryListEvent) => {
    cleanup?.();
    cleanup = mount(event.matches ? "mobile" : "desktop", seed);
  };

  mediaQuery.addEventListener("change", onModeChange);
  return () => {
    cleanup?.();
    mediaQuery.removeEventListener("change", onModeChange);
  };
}
