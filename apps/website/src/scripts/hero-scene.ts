import {
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  Group,
  MathUtils,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  TorusKnotGeometry,
  Vector2,
  WebGLRenderer,
} from "three";

type Mode = "desktop" | "mobile";

const CAM_Z = 8;

// Per-mode tuning
const CONFIG = {
  desktop: {
    diameter: 3.3, // approx. world-space diameter of the object at scale 1
    fill: 0.92, // how much of the anchor the object fills
    sizeFactor: 0.0075, // point size relative to anchor width
    wave: 0, // surface ripple amplitude
    spin: { y: 0.15, x: 0.08 },
  },
  mobile: {
    diameter: 3.2,
    fill: 0.9,
    sizeFactor: 0.009,
    wave: 0.09,
    spin: { y: 0.22, x: 0.05 },
  },
} satisfies Record<Mode, unknown>;

/** Desktop shape: a torus knot, using its vertices as a point cloud. */
function createKnot(): BufferGeometry {
  const geometry = new TorusKnotGeometry(1.25, 0.4, 320, 26);
  const count = geometry.attributes.position.count;
  const rand = new Float32Array(count);
  for (let i = 0; i < count; i++) rand[i] = Math.random();
  geometry.setAttribute("aRand", new BufferAttribute(rand, 1));
  return geometry;
}

/** Mobile shape: an evenly distributed sphere (Fibonacci lattice). */
function createSphere(count = 4800, radius = 1.4): BufferGeometry {
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const rand = new Float32Array(count);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    position.set([x * radius, y * radius, z * radius], i * 3);
    normal.set([x, y, z], i * 3);
    rand[i] = Math.random();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("normal", new BufferAttribute(normal, 3));
  geometry.setAttribute("aRand", new BufferAttribute(rand, 1));
  return geometry;
}

const vertexShader = /* glsl */ `
  uniform float uTime, uSize, uScale, uPixelRatio, uCamDist, uStrength, uWave;
  uniform vec2 uMouse;
  attribute float aRand;
  varying float vMix;
  varying float vAlpha;

  void main() {
    // Gentle breathing along the surface normal
    float breathe = sin(uTime * 1.2 + position.x * 3.0 + position.y * 2.0 + aRand * 6.2831) * 0.04;
    // Travelling ripple (only used by the mobile sphere)
    float ripple = sin(position.y * 4.0 - uTime * 1.6 + position.x * 2.0) * uWave;

    vec3 p = position + normal * (breathe + ripple);
    vec4 world = modelMatrix * vec4(p, 1.0);

    // Push points away from the pointer / touch / ghost pointer
    vec2 diff = world.xy - uMouse;
    float push = smoothstep(1.5 * uScale, 0.0, length(diff)) * uStrength;
    world.xy += normalize(diff + 1e-4) * push * 0.5 * uScale;
    world.z += push * 0.6 * uScale;

    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;

    // Perspective-aware point size with per-point variation
    gl_PointSize = uSize * uPixelRatio * (0.6 + aRand * 0.9)
                   * (1.0 + push * 0.9) * (uCamDist / -mv.z);

    // Fade points that are farther from the camera
    float depth = (-mv.z - uCamDist) / (1.7 * uScale);
    vAlpha = mix(1.0, 0.2, clamp(depth * 0.5 + 0.5, 0.0, 1.0));
    vMix = step(0.88, aRand); // about 12% of points use the accent color
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uAccent;
  varying float vMix;
  varying float vAlpha;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.38, r) * vAlpha;
    gl_FragColor = vec4(mix(uBase, uAccent, vMix), a);
    #include <colorspace_fragment>
  }
`;

function mount(mode: Mode): (() => void) | undefined {
  const wrap = document.querySelector<HTMLElement>("[data-scene]");
  const anchor = document.querySelector<HTMLElement>("[data-scene-anchor]");
  if (!wrap || !anchor) return;

  const cfg = CONFIG[mode];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Devices without hover (phones, most tablets) get an autonomous "ghost" pointer
  const useGhost = matchMedia("(hover: none)").matches;

  const abort = new AbortController();
  const { signal } = abort;

  // Renderer: transparent so it blends into the page background
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.className = "block h-full w-full";
  wrap.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = CAM_Z;

  const geometry = mode === "mobile" ? createSphere() : createKnot();

  // Read theme colors from the CSS variables in global.css
  const css = getComputedStyle(document.documentElement);
  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: 3 },
    uScale: { value: 1 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uCamDist: { value: CAM_Z },
    uStrength: { value: 0 }, // 0..1, how strongly the pointer pushes points
    uWave: { value: cfg.wave },
    uMouse: { value: new Vector2() }, // interaction point in world space
    uBase: { value: new Color(`rgb(${css.getPropertyValue("--black").trim()})`) },
    uAccent: { value: new Color(css.getPropertyValue("--accent").trim()) },
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

  // Layout: size the canvas layer and fit the object to the anchor element
  let worldPerPixel = 1;
  let scale = 1;
  const layout = () => {
    const rect = wrap.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();

    const worldH = 2 * Math.tan(MathUtils.degToRad(camera.fov / 2)) * CAM_Z;
    worldPerPixel = worldH / rect.height;

    scale = (a.width * worldPerPixel * cfg.fill) / cfg.diameter;
    group.scale.setScalar(scale);
    group.position.set(
      (a.left + a.width / 2 - (rect.left + rect.width / 2)) * worldPerPixel,
      -(a.top + a.height / 2 - (rect.top + rect.height / 2)) * worldPerPixel,
      0,
    );

    uniforms.uScale.value = scale;
    uniforms.uSize.value = Math.max(2, a.width * cfg.sizeFactor);
    renderer.render(scene, camera);
  };
  const ro = new ResizeObserver(layout);
  ro.observe(wrap);
  ro.observe(anchor);
  layout();

  // ---- Interaction state ----
  const pointerWorld = new Vector2(); // last real pointer position in world space
  const mouse = new Vector2(); // smoothed position sent to the shader
  let pointerActive = false;
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 }; // hover-based tilt (mouse)
  let dragRotY = 0; // drag-based rotation (touch)
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

  // Mouse: tracked on the whole window so the object reacts anywhere on the page
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      toWorld(e.clientX, e.clientY);
      pointerActive = true;
      tilt.tx = (e.clientX / innerWidth - 0.5) * 2;
      tilt.ty = (e.clientY / innerHeight - 0.5) * 2;
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

  // Touch / pen: only on the anchor, so page scrolling elsewhere is untouched
  anchor.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "mouse") return;
      dragging = true;
      pointerActive = true;
      lastX = e.clientX;
      toWorld(e.clientX, e.clientY);
    },
    { signal },
  );
  anchor.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "mouse" || !dragging) return;
      toWorld(e.clientX, e.clientY);
      const dx = e.clientX - lastX;
      lastX = e.clientX;
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

  // Pause rendering while off-screen
  let visible = true;
  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
  io.observe(wrap);

  const clock = new Clock();
  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;

    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;

    // Decide where the push comes from and how strong it is
    let targetStrength = 0;
    const target = pointerWorld.clone();
    if (pointerActive) {
      targetStrength = 1;
    } else if (useGhost) {
      // Ghost pointer wandering over the object
      const R = (cfg.diameter / 2) * scale;
      target.set(
        group.position.x + Math.cos(t * 0.9) * 0.45 * R,
        group.position.y + Math.sin(t * 1.3) * 0.4 * R,
      );
      targetStrength = 0.75;
    }

    // Snap when the effect is invisible, otherwise ease (avoids sweeping across the object)
    if (uniforms.uStrength.value < 0.02) mouse.copy(target);
    else mouse.lerp(target, 0.15);
    uniforms.uMouse.value.copy(mouse);
    uniforms.uStrength.value += (targetStrength - uniforms.uStrength.value) * 0.08;

    // Rotation: idle spin + hover tilt (mouse) + drag inertia (touch)
    tilt.x += (tilt.tx - tilt.x) * 0.05;
    tilt.y += (tilt.ty - tilt.y) * 0.05;
    if (!dragging) {
      dragRotY += dragVel;
      dragVel *= 0.94;
    }
    group.rotation.y = t * cfg.spin.y + tilt.x * 0.4 + dragRotY;
    group.rotation.x = t * cfg.spin.x + tilt.y * 0.3;

    renderer.render(scene, camera);
  };
  if (!reduceMotion) tick();

  // Cleanup
  return () => {
    cancelAnimationFrame(raf);
    abort.abort();
    ro.disconnect();
    io.disconnect();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

/** Mounts the hero scene and swaps between the desktop and mobile variants on resize. */
export function initHeroScene() {
  const mq = matchMedia("(max-width: 767px)");
  let cleanup = mount(mq.matches ? "mobile" : "desktop");

  mq.addEventListener("change", (e) => {
    cleanup?.();
    cleanup = mount(e.matches ? "mobile" : "desktop");
  });
}
