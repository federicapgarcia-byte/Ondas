const canvas = document.querySelector("#scene");
const ctx = canvas.getContext("2d");

const controls = {
  mass1: document.querySelector("#mass1"),
  mass2: document.querySelector("#mass2"),
  stiffness: document.querySelector("#stiffness"),
  force: document.querySelector("#force"),
  driveFrequency: document.querySelector("#driveFrequency"),
  initialStretch: document.querySelector("#initialStretch"),
};

const outputs = {
  x1: document.querySelector("#x1Out"),
  x2: document.querySelector("#x2Out"),
  v1: document.querySelector("#v1Out"),
  v2: document.querySelector("#v2Out"),
  stretch: document.querySelector("#stretchOut"),
  time: document.querySelector("#timeOut"),
  naturalFrequency: document.querySelector("#naturalFrequency"),
  frequencyRatio: document.querySelector("#frequencyRatio"),
  amp1: document.querySelector("#amp1Out"),
  amp2: document.querySelector("#amp2Out"),
  denominator: document.querySelector("#denominatorOut"),
  resonance: document.querySelector("#resonanceOut"),
  naturalA: document.querySelector("#naturalAOut"),
  offsetC2: document.querySelector("#offsetC2Out"),
  mass1: document.querySelector("#mass1Value"),
  mass2: document.querySelector("#mass2Value"),
  stiffness: document.querySelector("#stiffnessValue"),
  force: document.querySelector("#forceValue"),
  driveFrequency: document.querySelector("#driveFrequencyValue"),
  initialStretch: document.querySelector("#initialStretchValue"),
};

const playPauseButton = document.querySelector("#playPause");
const resetButton = document.querySelector("#reset");
const resonanceButton = document.querySelector("#resonance");

const state = {
  x1: 0,
  v1: 0,
  x2: 0,
  v2: 0,
  t: 0,
  running: true,
  trace: [],
  maxObserved: 1,
  lastFrame: performance.now(),
};

function parameters() {
  return {
    m1: Number(controls.mass1.value),
    m2: Number(controls.mass2.value),
    k: Number(controls.stiffness.value),
    f0: Number(controls.force.value),
    omega: Number(controls.driveFrequency.value),
  };
}

function naturalFrequency(params) {
  return Math.sqrt((params.k * (params.m1 + params.m2)) / (params.m1 * params.m2));
}

function stationaryResponse(params, omega = params.omega) {
  const omega2 = omega * omega;
  const denominator = (params.k - params.m1 * omega2) * (params.k - params.m2 * omega2) - params.k ** 2;
  const scale = Math.max(params.k ** 2, params.m1 * params.m2 * Math.max(1, omega2 ** 2));
  const singular = Math.abs(denominator) < scale * 1e-8;

  if (singular) {
    return { x1: Infinity, x2: Infinity, denominator, singular };
  }

  return {
    x1: (params.f0 * (params.k - params.m2 * omega2)) / denominator,
    x2: (params.f0 * params.k) / denominator,
    denominator,
    singular,
  };
}

function solutionConstants(params, response) {
  if (!Number.isFinite(response.x1) || !Number.isFinite(response.x2)) {
    return { a: Infinity, c2: Infinity };
  }

  const stretch = Number(controls.initialStretch.value);
  const totalMass = params.m1 + params.m2;
  const a = (params.m2 / totalMass) * (response.x2 - response.x1 - stretch);
  const c2 = -((params.m1 * response.x1 + params.m2 * response.x2) / totalMass);

  return { a, c2 };
}

function acceleration(x1, x2, t, params) {
  const springTerm = params.k * (x1 - x2);
  const drive = params.f0 * Math.cos(params.omega * t);

  return {
    a1: (drive - springTerm) / params.m1,
    a2: springTerm / params.m2,
  };
}

function rk4Step(dt) {
  const params = parameters();
  const start = { x1: state.x1, v1: state.v1, x2: state.x2, v2: state.v2, t: state.t };

  const k1 = derivatives(start, params);
  const k2 = derivatives(addState(start, k1, dt * 0.5), params);
  const k3 = derivatives(addState(start, k2, dt * 0.5), params);
  const k4 = derivatives(addState(start, k3, dt), params);

  state.x1 += (dt / 6) * (k1.x1 + 2 * k2.x1 + 2 * k3.x1 + k4.x1);
  state.v1 += (dt / 6) * (k1.v1 + 2 * k2.v1 + 2 * k3.v1 + k4.v1);
  state.x2 += (dt / 6) * (k1.x2 + 2 * k2.x2 + 2 * k3.x2 + k4.x2);
  state.v2 += (dt / 6) * (k1.v2 + 2 * k2.v2 + 2 * k3.v2 + k4.v2);
  state.t += dt;

  const stretch = state.x2 - state.x1;
  state.maxObserved = Math.max(
    state.maxObserved * 0.9995,
    Math.abs(state.x1),
    Math.abs(state.x2),
    Math.abs(stretch)
  );
  state.trace.push({ t: state.t, x1: state.x1, x2: state.x2, stretch });

  if (state.trace.length > 900) {
    state.trace.shift();
  }
}

function derivatives(value, params) {
  const acc = acceleration(value.x1, value.x2, value.t, params);
  return {
    x1: value.v1,
    v1: acc.a1,
    x2: value.v2,
    v2: acc.a2,
    t: 1,
  };
}

function addState(value, derivative, dt) {
  return {
    x1: value.x1 + derivative.x1 * dt,
    v1: value.v1 + derivative.v1 * dt,
    x2: value.x2 + derivative.x2 * dt,
    v2: value.v2 + derivative.v2 * dt,
    t: value.t + derivative.t * dt,
  };
}

function reset() {
  const params = parameters();
  const totalMass = params.m1 + params.m2;
  const stretch = Number(controls.initialStretch.value);

  state.x1 = -(params.m2 / totalMass) * stretch;
  state.x2 = (params.m1 / totalMass) * stretch;
  state.v1 = 0;
  state.v2 = 0;
  state.t = 0;
  state.maxObserved = Math.max(1, Math.abs(stretch));
  state.trace = [{ t: 0, x1: state.x1, x2: state.x2, stretch }];
  state.lastFrame = performance.now();
}

function formatValue(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "infinita";
  }

  const absolute = Math.abs(value);
  if (absolute >= 10000 || (absolute > 0 && absolute < 0.001)) {
    return value.toExponential(2);
  }

  return value.toFixed(digits);
}

function syncLabels() {
  const params = parameters();
  const omegaN = naturalFrequency(params);
  const response = stationaryResponse(params);
  const constants = solutionConstants(params, response);
  const ratio = params.omega / omegaN;
  const nearResonance = Math.abs(params.omega - omegaN) / omegaN < 0.015;

  outputs.mass1.value = `${params.m1.toFixed(1)} kg`;
  outputs.mass2.value = `${params.m2.toFixed(1)} kg`;
  outputs.stiffness.value = `${params.k.toFixed(0)} N/m`;
  outputs.force.value = `${params.f0.toFixed(1)} N`;
  outputs.driveFrequency.value = `${params.omega.toFixed(2)} rad/s`;
  outputs.initialStretch.value = `${Number(controls.initialStretch.value).toFixed(2)} m`;
  outputs.x1.value = formatValue(state.x1);
  outputs.x2.value = formatValue(state.x2);
  outputs.v1.value = formatValue(state.v1);
  outputs.v2.value = formatValue(state.v2);
  outputs.stretch.value = formatValue(state.x2 - state.x1);
  outputs.time.value = state.t.toFixed(2);
  outputs.naturalFrequency.value = omegaN.toFixed(2);
  outputs.frequencyRatio.value = ratio.toFixed(2);
  outputs.amp1.value = formatValue(Math.abs(response.x1));
  outputs.amp2.value = formatValue(Math.abs(response.x2));
  outputs.denominator.value = formatValue(response.denominator, 1);
  outputs.resonance.value = nearResonance ? "si" : "no";
  outputs.resonance.dataset.hot = nearResonance ? "true" : "false";
  outputs.naturalA.value = formatValue(constants.a);
  outputs.offsetC2.value = formatValue(constants.c2);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(680, Math.floor(rect.width * dpr));
  const height = Math.max(420, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawSpring(x0, y, x1, coils, amplitude) {
  const length = x1 - x0;
  const segments = coils * 2;

  ctx.beginPath();
  ctx.moveTo(x0, y);

  for (let i = 1; i <= segments; i += 1) {
    const progress = i / segments;
    const x = x0 + progress * length;
    const offset = i % 2 === 0 ? -amplitude : amplitude;
    ctx.lineTo(x, y + offset);
  }

  ctx.lineTo(x1, y);
  ctx.stroke();
}

function drawArrow(x0, y, length, color) {
  if (Math.abs(length) < 2) {
    return;
  }

  const x1 = x0 + length;
  const direction = Math.sign(length);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x1 - direction * 12, y - 7);
  ctx.lineTo(x1 - direction * 12, y + 7);
  ctx.closePath();
  ctx.fill();
}

function drawGrid(width, height) {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;

  for (let gx = 0; gx < width; gx += 44) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }

  for (let gy = 0; gy < height; gy += 44) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }
}

function drawMass(x, y, width, height, color, label) {
  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x - width / 2, y - height / 2, width, height);

  ctx.fillStyle = "#f5f7fa";
  ctx.font = "800 15px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
}

function drawTimePlot(x, y, width, height) {
  const maxValue = Math.max(
    0.25,
    ...state.trace.map((point) => Math.max(Math.abs(point.x1), Math.abs(point.x2)))
  );

  ctx.strokeStyle = "#323b49";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.beginPath();
  ctx.moveTo(x, y + height / 2);
  ctx.lineTo(x + width, y + height / 2);
  ctx.stroke();

  drawTraceLine(x, y, width, height, maxValue, "x1", "#ffbf5f");
  drawTraceLine(x, y, width, height, maxValue, "x2", "#55c7a8");

  ctx.fillStyle = "#aeb8c5";
  ctx.font = "700 13px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("x1, x2 en el tiempo", x + 10, y + 20);
}

function drawTraceLine(x, y, width, height, maxValue, key, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  state.trace.forEach((point, index) => {
    const px = x + (index / Math.max(1, state.trace.length - 1)) * width;
    const py = y + height / 2 - (point[key] / maxValue) * (height * 0.42);

    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  });

  ctx.stroke();
}

function drawResponsePlot(x, y, width, height, params) {
  const omegaN = naturalFrequency(params);
  const maxOmega = Number(controls.driveFrequency.max);
  const maxDisplayAmp = 250;
  const maxTransformed = Math.log1p(maxDisplayAmp);

  ctx.strokeStyle = "#323b49";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  drawResponseCurve(x, y, width, height, params, maxOmega, maxTransformed, "x1", "#ffbf5f");
  drawResponseCurve(x, y, width, height, params, maxOmega, maxTransformed, "x2", "#55c7a8");

  const resonanceX = x + (omegaN / maxOmega) * width;
  const currentX = x + (params.omega / maxOmega) * width;

  ctx.strokeStyle = "#ef6f6c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(resonanceX, y);
  ctx.lineTo(resonanceX, y + height);
  ctx.stroke();

  ctx.strokeStyle = "rgba(245, 247, 250, 0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(currentX, y);
  ctx.lineTo(currentX, y + height);
  ctx.stroke();

  ctx.fillStyle = "#aeb8c5";
  ctx.font = "700 13px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("amplitud estacionaria vs w", x + 10, y + 20);
  ctx.fillText("wn", Math.min(x + width - 28, resonanceX + 6), y + height - 10);
  ctx.fillText("w", Math.min(x + width - 20, currentX + 6), y + 36);
}

function drawResponseCurve(x, y, width, height, params, maxOmega, maxTransformed, key, color) {
  const samples = 260;
  const omegaN = naturalFrequency(params);
  const gap = maxOmega / samples;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  let drawing = false;

  for (let index = 0; index < samples; index += 1) {
    const omega = 0.1 + (index / (samples - 1)) * (maxOmega - 0.1);
    const response = stationaryResponse(params, omega);
    const raw = Math.abs(response[key]);
    const closeToResonance = Math.abs(omega - omegaN) < gap * 1.1;

    if (!Number.isFinite(raw) || closeToResonance) {
      drawing = false;
      continue;
    }

    const transformed = Math.log1p(Math.min(raw, 250));
    const px = x + (omega / maxOmega) * width;
    const py = y + height - (transformed / maxTransformed) * (height * 0.88) - height * 0.06;

    if (!drawing) {
      ctx.moveTo(px, py);
      drawing = true;
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.stroke();
}

function drawLegend(x, y) {
  ctx.font = "700 13px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#ffbf5f";
  ctx.fillRect(x, y - 5, 18, 4);
  ctx.fillStyle = "#aeb8c5";
  ctx.fillText("m1 / x1", x + 26, y);

  ctx.fillStyle = "#55c7a8";
  ctx.fillRect(x + 94, y - 5, 18, 4);
  ctx.fillStyle = "#aeb8c5";
  ctx.fillText("m2 / x2", x + 120, y);
}

function draw() {
  resizeCanvas();

  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const params = parameters();
  const omegaN = naturalFrequency(params);
  const y = height * 0.33;
  const base1 = width * 0.36;
  const base2 = width * 0.64;
  const maxShift = Math.min(170, width * 0.18);
  const displacementScale = maxShift / Math.max(2.6, state.maxObserved * 1.25);
  const massW = Math.max(72, Math.min(116, width * 0.095));
  const massH = Math.max(54, Math.min(84, height * 0.13));
  const x1 = base1 + state.x1 * displacementScale;
  const x2 = base2 + state.x2 * displacementScale;
  const plotTop = height * 0.62;
  const plotGap = 18;
  const plotX = Math.max(28, width * 0.045);
  const plotW = width - plotX * 2;
  const eachPlotW = width > 760 ? (plotW - plotGap) / 2 : plotW;
  const plotH = width > 760 ? height * 0.27 : height * 0.17;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0c0f14";
  ctx.fillRect(0, 0, width, height);
  drawGrid(width, height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.12, y + massH * 0.72);
  ctx.lineTo(width * 0.88, y + massH * 0.72);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 191, 95, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(base1, y - massH);
  ctx.lineTo(base1, y + massH);
  ctx.stroke();

  ctx.strokeStyle = "rgba(85, 199, 168, 0.35)";
  ctx.beginPath();
  ctx.moveTo(base2, y - massH);
  ctx.lineTo(base2, y + massH);
  ctx.stroke();

  ctx.strokeStyle = "#485364";
  ctx.lineWidth = 4;
  drawSpring(x1 + massW / 2, y, x2 - massW / 2, 13, Math.max(12, massH * 0.22));

  const phase = Math.cos(params.omega * state.t);
  const forceLength = phase * Math.min(92, Math.max(32, params.f0 * 4));
  drawArrow(x1, y - massH * 0.78, forceLength, phase >= 0 ? "#55c7a8" : "#ef6f6c");

  drawMass(x1, y, massW, massH, "#ffbf5f", "m1");
  drawMass(x2, y, massW, massH, "#55c7a8", "m2");

  ctx.fillStyle = "#aeb8c5";
  ctx.font = "700 14px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`wn = ${omegaN.toFixed(2)} rad/s`, plotX, y - massH * 1.28);
  ctx.fillText(`F = ${params.f0.toFixed(1)} cos(${params.omega.toFixed(2)}t) N`, plotX, y - massH * 0.92);
  drawLegend(plotX, y + massH * 1.35);

  if (width > 760) {
    drawTimePlot(plotX, plotTop, eachPlotW, plotH);
    drawResponsePlot(plotX + eachPlotW + plotGap, plotTop, eachPlotW, plotH, params);
  } else {
    drawTimePlot(plotX, plotTop - 34, plotW, plotH);
    drawResponsePlot(plotX, plotTop + plotH + 12, plotW, plotH, params);
  }
}

function frame(now) {
  const elapsed = Math.min(0.05, (now - state.lastFrame) / 1000);
  state.lastFrame = now;

  if (state.running) {
    const step = 1 / 480;
    let remaining = elapsed;

    while (remaining > 0) {
      const dt = Math.min(step, remaining);
      rk4Step(dt);
      remaining -= dt;
    }
  }

  syncLabels();
  draw();
  requestAnimationFrame(frame);
}

Object.values(controls).forEach((control) => {
  control.addEventListener("input", () => {
    if (control === controls.initialStretch) {
      reset();
    }

    syncLabels();
  });
});

[controls.mass1, controls.mass2].forEach((control) => {
  control.addEventListener("change", reset);
});

playPauseButton.addEventListener("click", () => {
  state.running = !state.running;
  playPauseButton.textContent = state.running ? "Pausar" : "Continuar";
  state.lastFrame = performance.now();
});

resetButton.addEventListener("click", reset);

resonanceButton.addEventListener("click", () => {
  const params = parameters();
  const omegaN = naturalFrequency(params);
  const max = Number(controls.driveFrequency.max);
  controls.driveFrequency.value = Math.min(max, omegaN).toString();
  reset();
  syncLabels();
});

window.addEventListener("resize", draw);

reset();
syncLabels();
requestAnimationFrame(frame);
