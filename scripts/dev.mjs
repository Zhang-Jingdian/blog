#!/usr/bin/env node
/**
 * Start every app with one command, in dependency order:
 *
 *   api (5173) -> admin (5174) -> website (4321)
 *
 * Each service is started only after the previous one is actually listening.
 * That matters because the admin dev server proxies /api to 5173 and the
 * website calls the API on every request — starting them too early produces
 * confusing proxy/500 errors.
 *
 * Ctrl+C stops everything (children run in their own process group, so their
 * sub-processes are killed too).
 *
 * The ports below must stay in sync with:
 *   - apps/admin/vite.config.ts  (server.port + proxy target)
 *   - apps/api/.env              (ADMIN_ORIGIN)
 *   - apps/website/src/lib/api.ts (default API base URL)
 */
import { spawn, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
};

const NAME_WIDTH = 7;
const READY_TIMEOUT_MS = 120_000;

const SERVICES = [
  { name: "api", dir: "apps/api", port: 5173, color: "\x1b[36m" },
  { name: "admin", dir: "apps/admin", port: 5174, color: "\x1b[35m" },
  { name: "website", dir: "apps/website", port: 4321, color: "\x1b[32m" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pad = (text) => text.padEnd(NAME_WIDTH, " ");

const children = [];
let stopping = false;

// ---------------------------------------------------------------- port utils

function probe(port, host, timeout) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    const settle = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
  });
}

async function canConnect(port) {
  // Dev servers bind `localhost`, which Node resolves to ::1 first on macOS.
  // Probing 127.0.0.1 only would report a live IPv6-only server as down.
  if (await probe(port, "localhost", 400)) return true;
  return probe(port, "127.0.0.1", 300);
}

function listenerPids(port) {
  try {
    const out = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out
      .split("\n")
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

async function waitForPort(service, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < READY_TIMEOUT_MS) {
    if (child.exited) return false;
    if (await canConnect(service.port)) return true;
    await sleep(200);
  }
  return false;
}

// ------------------------------------------------------------ child process

function devScript(dir) {
  const pkg = JSON.parse(readFileSync(join(repoRoot, dir, "package.json"), "utf8"));
  const script = pkg.scripts?.dev;
  if (!script) throw new Error(`${dir}/package.json has no "dev" script`);
  return script;
}

/**
 * Vite+ runs on its own managed Node (e.g. v26), which is newer than whatever
 * `node` is on the system PATH. `astro` refuses to run on the system version,
 * so children inherit the environment `vp` resolves for this project.
 */
function managedPath() {
  const fallback = process.env.PATH ?? "";
  try {
    const out = execFileSync("vp", ["env", "print"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = out.match(/export PATH="([^"]*)"/);
    if (!match) return fallback;
    return match[1].replaceAll("$PATH", fallback);
  } catch {
    return fallback;
  }
}

let inheritedPath = null;

// `sh -c` gets the bare parent PATH, which lacks the per-package .bin dirs that
// a package manager would normally inject. Without them `astro dev` resolves to
// "command not found".
function scriptPath(dir) {
  inheritedPath ??= managedPath();
  return [
    join(repoRoot, dir, "node_modules", ".bin"),
    join(repoRoot, "node_modules", ".bin"),
    inheritedPath,
  ]
    .filter(Boolean)
    .join(delimiter);
}

function writeLine(service, line) {
  process.stdout.write(
    `${service.color}${pad(service.name)}${C.reset}${C.dim}│${C.reset} ${line}\n`,
  );
}

function pipeLines(service, stream) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      writeLine(service, buffer.slice(0, index));
      buffer = buffer.slice(index + 1);
    }
  });
  stream.on("end", () => {
    if (buffer) writeLine(service, buffer);
    buffer = "";
  });
}

function startService(service) {
  const script = devScript(service.dir);
  process.stdout.write(
    `${C.dim}▸${C.reset} ${service.color}${pad(service.name)}${C.reset} ${C.dim}${script}${C.reset}\n`,
  );

  const [command, args] =
    process.platform === "win32" ? ["cmd.exe", ["/c", script]] : ["/bin/sh", ["-c", script]];

  const child = spawn(command, args, {
    cwd: join(repoRoot, service.dir),
    // Own process group, so shutdown can kill the whole tree at once.
    detached: process.platform !== "win32",
    // Keep ANSI colors alive even though stdout is a pipe.
    env: { ...process.env, PATH: scriptPath(service.dir), FORCE_COLOR: "1", CLICOLOR_FORCE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.exited = false;
  pipeLines(service, child.stdout);
  pipeLines(service, child.stderr);

  child.on("error", (error) => {
    process.stderr.write(
      `\n${C.red}✗ ${service.name} failed to start: ${error.message}${C.reset}\n`,
    );
    void shutdown(1);
  });

  child.on("exit", (code, signal) => {
    child.exited = true;
    if (stopping) return;
    const status = signal ? `signal ${signal}` : `exit code ${code}`;
    process.stderr.write(
      `\n${C.red}✗ ${service.name} stopped unexpectedly (${status})${C.reset}\n`,
    );
    void shutdown(code ?? 1);
  });

  children.push(child);
  return child;
}

function killTree(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    /* already gone */
  }
}

function killPid(pid, signal) {
  try {
    process.kill(pid, signal);
  } catch {
    /* already gone */
  }
}

/**
 * `vp dev` / `astro dev` sit behind extra process layers, so killing the
 * spawned child's process group is not enough. We also kill whatever holds the
 * service port — ours by construction, since we refuse to start on a busy port.
 */
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;

  process.stdout.write(`\n${C.dim}stopping dev servers…${C.reset}\n`);

  const targets = (service) =>
    [...new Set([...(service.pids ?? []), ...listenerPids(service.port)])].filter(Boolean);

  const survivors = () => SERVICES.filter((service) => targets(service).length > 0).length;

  for (const service of [...SERVICES].reverse()) {
    for (const pid of targets(service)) killPid(pid, "SIGTERM");
  }
  for (const child of [...children].reverse()) killTree(child, "SIGTERM");

  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline && survivors() > 0) await sleep(100);

  for (const service of SERVICES) {
    for (const pid of targets(service)) killPid(pid, "SIGKILL");
  }
  for (const child of children) killTree(child, "SIGKILL");

  process.exit(code);
}

// --------------------------------------------------------------------- main

async function main() {
  // Fail fast when a port is taken: Vite would silently pick the next free
  // port, which breaks the admin proxy and the API's CORS allowlist.
  const busy = [];
  for (const service of SERVICES) {
    if (await canConnect(service.port)) {
      busy.push({ ...service, pids: listenerPids(service.port) });
    }
  }

  if (busy.length > 0) {
    process.stderr.write(`${C.red}✗ Port already in use, refusing to start:${C.reset}\n`);
    for (const service of busy) {
      const who = service.pids.length > 0 ? `pid ${service.pids.join(", ")}` : "unknown process";
      process.stderr.write(
        `    ${pad(service.name)} :${service.port}  ${C.dim}(${who})${C.reset}\n`,
      );
    }
    const pids = busy.flatMap((service) => service.pids);
    process.stderr.write(
      `\n${C.dim}Stop it first, e.g. ${C.reset}kill ${pids.length > 0 ? pids.join(" ") : "<pid>"}\n`,
    );
    process.exit(1);
  }

  for (const service of SERVICES) {
    const startedAt = Date.now();
    const child = startService(service);

    if (!(await waitForPort(service, child))) {
      // The exit handler already reported the failure and started shutdown.
      if (child.exited) return;
      process.stderr.write(
        `\n${C.red}✗ ${service.name} did not start listening on :${service.port} within ${
          READY_TIMEOUT_MS / 1000
        }s${C.reset}\n`,
      );
      await shutdown(1);
      return;
    }

    // Remember who actually holds the port so shutdown can stop it.
    service.pids = listenerPids(service.port);

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    process.stdout.write(
      `${C.green}✓${C.reset} ${service.color}${pad(service.name)}${C.reset} ${C.dim}listening on${C.reset} http://localhost:${service.port} ${C.dim}(${seconds}s)${C.reset}\n`,
    );
  }

  process.stdout.write(
    `\n${C.bold}All services up.${C.reset}\n` +
      SERVICES.map(
        (service) =>
          `  ${service.color}●${C.reset} ${pad(service.name)} http://localhost:${service.port}`,
      ).join("\n") +
      `\n${C.dim}Ctrl+C to stop everything.${C.reset}\n\n`,
  );
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
process.on("unhandledRejection", (error) => {
  process.stderr.write(
    `\n${C.red}✗ ${error instanceof Error ? error.message : String(error)}${C.reset}\n`,
  );
  void shutdown(1);
});

main().catch((error) => {
  process.stderr.write(`\n${C.red}✗ ${error.message ?? error}${C.reset}\n`);
  void shutdown(1);
});
