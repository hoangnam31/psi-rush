import { performance } from "node:perf_hooks";

const args = new Map(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.split("=");
  return [key.replace(/^--/, ""), rest.join("=") || "true"];
}));

const baseUrl = (args.get("url") || "http://127.0.0.1:5173").replace(/\/$/, "");
const playerCount = Math.max(2, Math.min(200, Number(args.get("players") || 200)));
const durationSeconds = Math.max(5, Number(args.get("duration") || 20));
const joinConcurrency = Math.max(1, Number(args.get("join-concurrency") || 20));
const stateInterval = Math.max(250, Number(args.get("state-interval") || 6000));
const progressInterval = Math.max(250, Number(args.get("progress-interval") || 850));
const requestTimeout = Math.max(1000, Number(args.get("timeout") || 10_000));
const runId = Date.now().toString(36).slice(-7);
const metrics = new Map();

function metric(name) {
  if (!metrics.has(name)) metrics.set(name, { latencies: [], errors: 0, requests: 0, bytes: 0, statuses: {} });
  return metrics.get(name);
}

async function request(name, path, options, parseJson = true) {
  const entry = metric(name);
  const started = performance.now();
  entry.requests++;
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...options, signal: AbortSignal.timeout(requestTimeout) });
    const text = await response.text();
    const elapsed = performance.now() - started;
    entry.latencies.push(elapsed);
    entry.bytes += Buffer.byteLength(text);
    entry.statuses[response.status] = (entry.statuses[response.status] || 0) + 1;
    let data = null;
    if (parseJson && text) {
      try { data = JSON.parse(text); }
      catch { throw new Error(`Invalid JSON (${response.status}): ${text.slice(0, 120)}`); }
    }
    if (!response.ok) throw new Error(`${response.status}: ${data?.error || text.slice(0, 120)}`);
    return data;
  } catch (error) {
    entry.errors++;
    if (!entry.latencies.length || performance.now() - started > entry.latencies.at(-1) + 1) {
      entry.latencies.push(performance.now() - started);
    }
    throw error;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function mapConcurrent(items, concurrency, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function summarize(name, entry) {
  return {
    requests: entry.requests,
    errors: entry.errors,
    errorRate: entry.requests ? Number((entry.errors / entry.requests * 100).toFixed(3)) : 0,
    p50Ms: Number(percentile(entry.latencies, .5).toFixed(1)),
    p95Ms: Number(percentile(entry.latencies, .95).toFixed(1)),
    p99Ms: Number(percentile(entry.latencies, .99).toFixed(1)),
    maxMs: Number(Math.max(0, ...entry.latencies).toFixed(1)),
    responseMiB: Number((entry.bytes / 1024 / 1024).toFixed(2)),
    statuses: entry.statuses,
  };
}

async function fixedRateLoop({ interval, stagger, endAt, task }) {
  let nextAt = performance.now() + stagger;
  while (nextAt < endAt) {
    await sleep(Math.max(0, nextAt - performance.now()));
    if (performance.now() >= endAt) break;
    try { await task(); } catch { /* Counted by request(). */ }
    nextAt += interval;
    if (nextAt < performance.now() - interval) nextAt = performance.now();
  }
}

async function main() {
  const testStarted = performance.now();
  const room = await request("create", "/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: `LOAD-${runId}`, maxPlayers: playerCount, totalRounds: 1, mapPool: ["sky"] }),
  });

  const indices = Array.from({ length: playerCount }, (_, index) => index);
  const players = await mapConcurrent(indices, joinConcurrency, async (index) => {
    const name = `LT${runId}-${String(index + 1).padStart(3, "0")}`.slice(0, 16);
    const joined = await request("join", `/api/rooms/${room.code}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "join", name, color: ["#8b5cf6", "#ff3d9a", "#35dcff", "#ffb238"][index % 4] }),
    });
    return { ...joined, index };
  });

  await mapConcurrent(players, 30, (player) => request("ready", `/api/rooms/${room.code}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "ready", ready: true, playerId: player.playerId, playerToken: player.playerToken }),
  }));

  await request("start", `/api/rooms/${room.code}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "start", hostToken: room.hostToken }),
  });

  const loadStarted = performance.now();
  const endAt = loadStarted + durationSeconds * 1000;
  const loops = [];
  for (const player of players) {
    loops.push(fixedRateLoop({
      interval: stateInterval,
      stagger: player.index / playerCount * stateInterval,
      endAt,
      task: () => request("state", `/api/rooms/${room.code}`, { cache: "no-store" }),
    }));
    loops.push(fixedRateLoop({
      interval: progressInterval,
      stagger: player.index / playerCount * progressInterval,
      endAt,
      task: () => {
        const elapsed = performance.now() - loadStarted;
        const progress = Math.min(99, elapsed / (durationSeconds * 1000) * 90 + player.index % 7);
        const positionX = 180 + (player.index * 37 + Math.floor(elapsed / 100)) % 2600;
        return request("progress", `/api/rooms/${room.code}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "progress", playerId: player.playerId, playerToken: player.playerToken, progress, positionX }),
        });
      },
    }));
  }
  await Promise.all(loops);

  const finalState = await request("verify", `/api/rooms/${room.code}`, { cache: "no-store" });
  const summaries = Object.fromEntries([...metrics].map(([name, entry]) => [name, summarize(name, entry)]));
  const runtimeRequests = (summaries.state?.requests || 0) + (summaries.progress?.requests || 0);
  const runtimeErrors = (summaries.state?.errors || 0) + (summaries.progress?.errors || 0);
  const actualDuration = (performance.now() - loadStarted) / 1000;
  const checks = {
    joinedAllPlayers: players.length === playerCount,
    rosterHasAllPlayers: finalState.players?.length === playerCount,
    zeroRuntimeErrors: runtimeErrors === 0,
    stateP95WithinPollWindow: (summaries.state?.p95Ms || Infinity) < stateInterval,
    progressP95WithinSyncWindow: (summaries.progress?.p95Ms || Infinity) < progressInterval,
  };
  const passed = Object.values(checks).every(Boolean);
  const report = {
    passed,
    target: baseUrl,
    roomCode: room.code,
    players: playerCount,
    configuredDurationSeconds: durationSeconds,
    actualDurationSeconds: Number(actualDuration.toFixed(2)),
    runtimeRequests,
    runtimeErrors,
    achievedRequestsPerSecond: Number((runtimeRequests / actualDuration).toFixed(1)),
    totalTestSeconds: Number(((performance.now() - testStarted) / 1000).toFixed(2)),
    checks,
    metrics: summaries,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ passed: false, target: baseUrl, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
