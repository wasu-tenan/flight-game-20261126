// The renderer: everything Ridge Runner shows, drawn on one 2D canvas.
//
// The view is a side-on chase camera: the plane sits at a fixed spot on
// screen and the valley scrolls past it. The sky, the ridges, the river,
// the town and the rings are all drawn from the world data, and the HUD
// carries altitude, speed and heading, fuel, rings, time and score, plus
// three lit instruments: attitude, airspeed and altimeter.
//
// The renderer also owns the clickable buttons: each frame it records the
// rectangles it drew for buttons into `buttons`, and the game loop matches
// clicks against them.

import { VIEW, COLOURS, COURSE, PLANE } from './config.js';
import { groundHeightAt, riverAt, onStrip } from './world.js';
import { headingDeg } from './physics.js';

export const buttons = [];

function clearButtons() {
  buttons.length = 0;
}

function addButton(id, x, y, w, h) {
  buttons.push({ id, x, y, w, h });
}

function hitButton(id, x, y, w, h) {
  return buttons.find((b) => b.id === id && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
}

export function buttonAt(x, y) {
  const found = buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  return found ? found.id : null;
}

// World metres -> screen pixels. The plane is pinned at planeScreenX and
// at screen height 470; the world scrolls around it.
function toScreenX(flight, worldX) {
  return VIEW.planeScreenX + (worldX - flight.x) / VIEW.metresPerPixel;
}

function toScreenY(flight, altitude) {
  return 470 + (flight.altitude - altitude) / VIEW.metresPerPixel;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSky(ctx, timeSeconds) {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, COLOURS.skyTop);
  sky.addColorStop(0.45, COLOURS.skyMid);
  sky.addColorStop(0.72, COLOURS.skyLow);
  sky.addColorStop(1, '#e8a06a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Low dawn sun with a soft glow, fixed in the east.
  const sunX = 1080;
  const sunY = 170;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 190);
  glow.addColorStop(0, 'rgba(255, 217, 138, 0.9)');
  glow.addColorStop(1, 'rgba(255, 217, 138, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = COLOURS.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
  ctx.fill();

  // A few high streaks of cloud drift slowly with time.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 317 + timeSeconds * 3) % 1500) - 110;
    const cy = 70 + i * 26;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 90, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFarRidges(ctx, flight) {
  // Two distant ridge lines, drawn from the screen position so they move
  // slower than the valley: parallax, not world-locked.
  const layers = [
    { colour: COLOURS.mountainFar, base: 470, amp: 90, speed: 0.25, offset: 0 },
    { colour: COLOURS.mountainNear, base: 520, amp: 70, speed: 0.5, offset: 900 },
  ];
  for (const layer of layers) {
    ctx.fillStyle = layer.colour;
    ctx.beginPath();
    ctx.moveTo(0, VIEW.height);
    for (let sx = 0; sx <= VIEW.width; sx += 16) {
      const wx = sx + flight.x * layer.speed + layer.offset;
      const y =
        layer.base -
        layer.amp * (0.6 + 0.4 * Math.sin(wx * 0.004)) * Math.abs(Math.sin(wx * 0.0016 + 1.7));
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(VIEW.width, VIEW.height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawClouds(ctx, flight, scenery) {
  for (const cloud of scenery.clouds) {
    const span = COURSE.lengthMetres + 400;
    let rel = (cloud.x - flight.x * 0.55) % span;
    if (rel < -200) rel += span;
    const sx = VIEW.planeScreenX + rel / VIEW.metresPerPixel - 200;
    const sy = cloud.y - flight.altitude * 0.25;
    if (sx < -260 || sx > VIEW.width + 260 || sy < -60 || sy > 620) continue;
    ctx.fillStyle = cloud.layer === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, cloud.s * 1.6, cloud.s * 0.42, 0, 0, Math.PI * 2);
    ctx.ellipse(sx - cloud.s * 0.8, sy + 6, cloud.s * 0.9, cloud.s * 0.32, 0, 0, Math.PI * 2);
    ctx.ellipse(sx + cloud.s * 0.8, sy + 6, cloud.s * 0.9, cloud.s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTerrain(ctx, flight, scenery) {
  const step = 8;
  const x0 = flight.x - VIEW.planeScreenX * VIEW.metresPerPixel - 100;
  const x1 = flight.x + (VIEW.width - VIEW.planeScreenX) * VIEW.metresPerPixel + 100;

  // Valley floor, green where low, rock where high, snow on the peaks.
  ctx.beginPath();
  ctx.moveTo(toScreenX(flight, x0), VIEW.height + 40);
  for (let wx = x0; wx <= x1; wx += 20) {
    ctx.lineTo(toScreenX(flight, wx), toScreenY(flight, groundHeightAt(wx)));
  }
  ctx.lineTo(toScreenX(flight, x1), VIEW.height + 40);
  ctx.closePath();
  const ground = ctx.createLinearGradient(0, 300, 0, VIEW.height);
  ground.addColorStop(0, COLOURS.valleyGreen);
  ground.addColorStop(0.55, COLOURS.valleyDark);
  ground.addColorStop(1, '#2a4d26');
  ctx.fillStyle = ground;
  ctx.fill();

  // Rock faces where the ground rises steeply.
  ctx.fillStyle = COLOURS.rock;
  for (let wx = x0; wx <= x1; wx += 20) {
    const h = groundHeightAt(wx);
    if (h > 120) {
      const sx = toScreenX(flight, wx);
      const sy = toScreenY(flight, h);
      ctx.fillRect(sx, sy, 10, Math.min(60, (h - 120) * 0.4));
    }
  }

  // The river: a bright band where the ground dips low, mid-course.
  ctx.fillStyle = COLOURS.river;
  for (let wx = x0; wx <= x1; wx += 20) {
    if (!riverAt(wx)) continue;
    const sx = toScreenX(flight, wx);
    const sy = toScreenY(flight, groundHeightAt(wx));
    ctx.fillRect(sx, sy - 4, 12, 10);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let wx = x0; wx <= x1; wx += 90) {
    if (!riverAt(wx)) continue;
    const sx = toScreenX(flight, wx);
    const sy = toScreenY(flight, groundHeightAt(wx));
    ctx.fillRect(sx, sy - 1, 26, 2);
  }

  // Pine trees along the valley.
  for (const tree of scenery.trees) {
    const sx = toScreenX(flight, tree.x);
    if (sx < -40 || sx > VIEW.width + 40) continue;
    const sy = toScreenY(flight, groundHeightAt(tree.x));
    const th = tree.h / VIEW.metresPerPixel;
    const tw = tree.w / VIEW.metresPerPixel;
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(sx - 1, sy - th * 0.25, 2, th * 0.25);
    ctx.fillStyle = COLOURS.pine;
    ctx.beginPath();
    ctx.moveTo(sx, sy - th);
    ctx.lineTo(sx - tw / 2, sy - th * 0.2);
    ctx.lineTo(sx + tw / 2, sy - th * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  // Alderfield's houses with lit windows, by the far strip.
  for (const house of scenery.houses) {
    const sx = toScreenX(flight, house.x);
    if (sx < -60 || sx > VIEW.width + 60) continue;
    const sy = toScreenY(flight, 0);
    const hw = house.w / VIEW.metresPerPixel;
    const hh = house.h / VIEW.metresPerPixel;
    ctx.fillStyle = '#e8d9b0';
    ctx.fillRect(sx, sy - hh, hw, hh);
    ctx.fillStyle = '#b0492f';
    if (house.roof === 'peak') {
      ctx.beginPath();
      ctx.moveTo(sx - 2, sy - hh);
      ctx.lineTo(sx + hw / 2, sy - hh - 8);
      ctx.lineTo(sx + hw + 2, sy - hh);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(sx, sy - hh - 3, hw, 3);
    }
    if (house.lit) {
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(sx + hw * 0.2, sy - hh * 0.65, 4, 5);
      ctx.fillRect(sx + hw * 0.65, sy - hh * 0.65, 4, 5);
    }
  }

  // Birds over the valley, flapping with time.
  ctx.strokeStyle = 'rgba(30, 30, 30, 0.8)';
  ctx.lineWidth = 2;
  for (const bird of scenery.birds) {
    const bx = bird.x + Math.sin(bird.phase) * 30;
    const sx = toScreenX(flight, bx);
    if (sx < -20 || sx > VIEW.width + 20) continue;
    const sy = toScreenY(flight, bird.y) + Math.sin(bird.phase * 2) * 6;
    const flap = Math.sin(bird.phase * 6) * 4;
    ctx.beginPath();
    ctx.moveTo(sx - 8, sy - flap);
    ctx.quadraticCurveTo(sx - 3, sy + 2, sx, sy);
    ctx.quadraticCurveTo(sx + 3, sy + 2, sx + 8, sy - flap);
    ctx.stroke();
  }
}

function drawStrip(ctx, flight, strip, label) {
  const x0 = toScreenX(flight, strip.start);
  const x1 = toScreenX(flight, strip.end);
  const y = toScreenY(flight, 0);
  if (x1 < -40 || x0 > VIEW.width + 40) return;
  ctx.fillStyle = COLOURS.runway;
  ctx.fillRect(x0, y - 7, x1 - x0, 9);
  ctx.fillStyle = COLOURS.runwayMark;
  const dashCount = Math.floor((x1 - x0) / 26);
  for (let i = 0; i < dashCount; i++) {
    if (i % 2 === 0) ctx.fillRect(x0 + 8 + i * 26, y - 4, 14, 3);
  }
  // Threshold bars at both ends.
  ctx.fillRect(x0 + 4, y - 6, 4, 7);
  ctx.fillRect(x1 - 8, y - 6, 4, 7);
  // Edge lights, warm and lit.
  ctx.fillStyle = '#ffd76a';
  for (let wx = strip.start; wx <= strip.end; wx += 80) {
    const sx = toScreenX(flight, wx);
    ctx.beginPath();
    ctx.arc(sx, y - 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Windsock beside the strip.
  const sockX = toScreenX(flight, strip.start + 30);
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sockX, y - 7);
  ctx.lineTo(sockX, y - 34);
  ctx.stroke();
  ctx.fillStyle = '#ff7a3c';
  ctx.beginPath();
  ctx.moveTo(sockX, y - 34);
  ctx.lineTo(sockX + 16, y - 30);
  ctx.lineTo(sockX, y - 26);
  ctx.closePath();
  ctx.fill();
  // Strip name, readable at a glance.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, (x0 + x1) / 2, y + 26);
}

function drawRings(ctx, flight, rings, timeSeconds) {
  const next = rings.find((ring) => !ring.passed) ?? null;
  for (const ring of rings) {
    const sx = toScreenX(flight, ring.x);
    if (sx < -120 || sx > VIEW.width + 120) continue;
    const sy = toScreenY(flight, ring.y);
    const r = ring.r / VIEW.metresPerPixel;
    if (ring.passed) {
      // A passed ring stays as a faint green hoop, proof of the line flown.
      ctx.strokeStyle = 'rgba(126, 231, 135, 0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    const pulse = 1 + Math.sin(timeSeconds * 3 + ring.index) * 0.06;
    const isNext = next === ring;
    ctx.save();
    ctx.shadowColor = COLOURS.ringGlow;
    ctx.shadowBlur = isNext ? 26 : 12;
    ctx.strokeStyle = isNext ? COLOURS.ringGlow : COLOURS.ring;
    ctx.lineWidth = isNext ? 7 : 5;
    ctx.beginPath();
    ctx.arc(sx, sy, r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = isNext ? '#fff3c4' : '#ffe9a8';
    ctx.font = `bold ${isNext ? 20 : 16}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(ring.index + 1), sx, sy);
    ctx.textBaseline = 'alphabetic';
  }
  // Point the pilot at the next ring when it is off screen.
  if (next) {
    const sx = toScreenX(flight, next.x);
    if (sx > VIEW.width - 40 || sx < 40) {
      const edgeX = sx > VIEW.width - 40 ? VIEW.width - 70 : 70;
      const edgeY = Math.max(120, Math.min(560, toScreenY(flight, next.y)));
      const dist = Math.round(Math.abs(next.x - flight.x));
      ctx.fillStyle = COLOURS.ring;
      ctx.beginPath();
      ctx.moveTo(edgeX + (sx > VIEW.width - 40 ? 18 : -18), edgeY);
      ctx.lineTo(edgeX, edgeY - 12);
      ctx.lineTo(edgeX, edgeY + 12);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff3c4';
      ctx.fillText(`RING ${next.index + 1} · ${dist}m`, edgeX, edgeY + 30);
    }
  }
}

function drawPlane(ctx, flight, timeSeconds) {
  const px = VIEW.planeScreenX;
  const py = 470;
  const pitchRad = (-flight.pitchDeg * Math.PI) / 180;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(pitchRad);

  // Soft shadow on the ground far below, so the height reads.
  ctx.restore();
  const groundY = toScreenY(flight, groundHeightAt(flight.x));
  const heightAbove = Math.max(0, 470 - groundY);
  if (heightAbove < 400) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.22 * (1 - heightAbove / 400)})`;
    ctx.beginPath();
    ctx.ellipse(px, Math.min(groundY, 760), 46, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(pitchRad);

  // Contrail puffs behind the tail when climbing hard.
  if (flight.airborne && flight.pitchDeg > 8) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 4; i++) {
      const t = (timeSeconds * 0.7 + i * 0.25) % 1;
      ctx.beginPath();
      ctx.arc(-52 - t * 60, 6 + t * 8, 3 + t * 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Tailplane and fin.
  ctx.fillStyle = '#c23b2e';
  ctx.beginPath();
  ctx.moveTo(-34, -2);
  ctx.lineTo(-52, -16);
  ctx.lineTo(-46, -2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-30, -4);
  ctx.lineTo(-44, -20);
  ctx.lineTo(-36, -4);
  ctx.closePath();
  ctx.fill();

  // Wing, swept back under the fuselage.
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-22, 26);
  ctx.lineTo(-8, 28);
  ctx.lineTo(12, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c23b2e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(12, 6);
  ctx.stroke();

  // Fuselage: a built little bush plane, cream with a red stripe.
  ctx.fillStyle = '#f4efe2';
  ctx.beginPath();
  ctx.moveTo(-48, -4);
  ctx.quadraticCurveTo(-52, -10, -40, -11);
  ctx.lineTo(28, -11);
  ctx.quadraticCurveTo(48, -10, 52, -2);
  ctx.quadraticCurveTo(52, 6, 40, 8);
  ctx.lineTo(-38, 8);
  ctx.quadraticCurveTo(-48, 7, -48, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c23b2e';
  ctx.fillRect(-40, 2, 84, 4);
  ctx.fillStyle = '#3c4148';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RR-26', -8, -14);

  // Canopy, lit blue, with a pilot's helmet inside.
  ctx.fillStyle = '#9fd8ef';
  ctx.beginPath();
  ctx.moveTo(6, -11);
  ctx.quadraticCurveTo(10, -22, 22, -20);
  ctx.quadraticCurveTo(30, -18, 30, -11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(10, -19);
  ctx.lineTo(16, -20);
  ctx.lineTo(14, -13);
  ctx.lineTo(9, -13);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a4a2b';
  ctx.beginPath();
  ctx.arc(24, -15, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Spinning propeller: a blurred disc and two blades.
  const propAngle = timeSeconds * 28 + flight.speedKt * 0.05;
  ctx.fillStyle = 'rgba(200, 210, 220, 0.28)';
  ctx.beginPath();
  ctx.ellipse(54, -2, 4, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2c2f36';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(54, -2 - 18 * Math.cos(propAngle));
  ctx.lineTo(54, -2 + 18 * Math.cos(propAngle));
  ctx.stroke();
  ctx.fillStyle = '#2c2f36';
  ctx.beginPath();
  ctx.arc(54, -2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Navigation lights: red on the left wingtip, green on the right,
  // blinking with time so the aircraft reads as lit.
  const blink = Math.sin(timeSeconds * 6) > 0;
  if (blink) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-20, 26, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#34e07a';
    ctx.beginPath();
    ctx.arc(14, 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Landing gear, down while slow or on the ground.
  if (!flight.airborne || flight.speedKt < 120) {
    ctx.strokeStyle = '#3c4148';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-24, 8);
    ctx.lineTo(-24, 16);
    ctx.moveTo(24, 8);
    ctx.lineTo(24, 16);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-24, 18, 4, 0, Math.PI * 2);
    ctx.arc(24, 18, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// --- Instruments: three lit dials, bottom left --------------------------
function drawDial(ctx, cx, cy, r, label) {
  ctx.save();
  ctx.shadowColor = 'rgba(126, 231, 135, 0.5)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#0d1b26';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#8fb8d8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#eaf6ff';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r + 13);
}

function drawAttitude(ctx, cx, cy, r, flight) {
  drawDial(ctx, cx, cy, r, 'ATTITUDE');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate((-flight.pitchDeg * Math.PI) / 180);
  ctx.translate(0, (flight.pitchDeg / 32) * r * 0.9);
  ctx.fillStyle = '#3f7fc4';
  ctx.fillRect(-r, -r, r * 2, r);
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(-r, 0, r * 2, r);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-r, -1, r * 2, 2);
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#ffc233';
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-4, 0);
  ctx.lineTo(0, 4);
  ctx.lineTo(4, 0);
  ctx.lineTo(14, 0);
  ctx.lineTo(14, -3);
  ctx.lineTo(-14, -3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSpeedDial(ctx, cx, cy, r, flight) {
  drawDial(ctx, cx, cy, r, 'AIRSPEED kt');
  ctx.fillStyle = '#eaf6ff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(flight.speedKt)), cx, cy + 1);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = '#8fb8d8';
  ctx.fillText('0 — 210', cx, cy + 18);
  // Stall arc in red at the low end.
  ctx.strokeStyle = COLOURS.hudRed;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, Math.PI * 0.75, Math.PI * 0.75 + 0.5);
  ctx.stroke();
}

function drawAltimeter(ctx, cx, cy, r, flight) {
  drawDial(ctx, cx, cy, r, 'ALTIMETER ft');
  const feet = Math.round(flight.altitude * 3.28084);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(feet), cx, cy + 1);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = '#8fb8d8';
  ctx.fillText('QNH 1013', cx, cy + 18);
  // Needle sweeps with altitude.
  const angle = -Math.PI / 2 + (feet % 1000) / 1000 * Math.PI * 2;
  ctx.strokeStyle = COLOURS.hudAmber;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * (r - 8), cy + Math.sin(angle) * (r - 8));
  ctx.stroke();
}

function drawCompass(ctx, cx, y, w, flight) {
  ctx.fillStyle = COLOURS.hudPanel;
  roundRect(ctx, cx - w / 2, y, w, 34, 8);
  ctx.fill();
  const heading = headingDeg(flight);
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const marks = [0, 45, 90, 135, 180, 225, 270, 315];
  for (const mark of marks) {
    let diff = mark - heading;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    const mx = cx + diff * 2.4;
    if (mx < cx - w / 2 + 12 || mx > cx + w / 2 - 12) continue;
    const label = mark === 0 ? 'N' : mark === 90 ? 'E' : mark === 180 ? 'S' : mark === 270 ? 'W' : String(mark);
    ctx.fillText(label, mx, y + 22);
  }
  ctx.fillStyle = COLOURS.hudAmber;
  ctx.beginPath();
  ctx.moveTo(cx, y + 2);
  ctx.lineTo(cx - 5, y - 5);
  ctx.lineTo(cx + 5, y - 5);
  ctx.closePath();
  ctx.fill();
}

// --- HUD ------------------------------------------------------------------
function drawHud(ctx, flight, rings, timeSeconds) {
  const next = rings.find((ring) => !ring.passed) ?? null;
  ctx.fillStyle = COLOURS.hudPanel;
  roundRect(ctx, 16, 14, 1248, 64, 12);
  ctx.fill();

  const feet = Math.round(flight.altitude * 3.28084);
  const heading = Math.round(((headingDeg(flight) % 360) + 360) % 360);
  const cells = [
    { label: 'ALTITUDE', value: `${feet.toLocaleString('en-US')} ft`, warn: flight.altitude < 40 && flight.airborne },
    { label: 'AIRSPEED', value: `${Math.round(flight.speedKt)} kt`, warn: flight.stalled },
    { label: 'HEADING', value: `${String(heading).padStart(3, '0')}°`, warn: false },
    { label: 'RINGS', value: `${flight.ringsPassed} / ${rings.length}`, warn: false },
    { label: 'TIME', value: formatTime(flight.timeSeconds), warn: false },
    { label: 'SCORE', value: String(flight.score), warn: false },
  ];
  ctx.textAlign = 'left';
  let x = 36;
  for (const cell of cells) {
    ctx.fillStyle = '#8fb8d8';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(cell.label, x, 36);
    ctx.fillStyle = cell.warn ? COLOURS.hudRed : COLOURS.hudText;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(cell.value, x, 62);
    x += cell.label === 'ALTITUDE' ? 190 : cell.label === 'AIRSPEED' ? 150 : cell.label === 'HEADING' ? 130 : cell.label === 'RINGS' ? 120 : cell.label === 'TIME' ? 130 : 150;
  }

  // Fuel gauge, right side of the top bar.
  const fuelX = 1010;
  ctx.fillStyle = '#8fb8d8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('FUEL', fuelX, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, fuelX, 44, 180, 16, 8);
  ctx.fill();
  const fuelColour = flight.fuel < 25 ? COLOURS.hudRed : flight.fuel < 50 ? COLOURS.hudAmber : COLOURS.hudGreen;
  ctx.fillStyle = fuelColour;
  roundRect(ctx, fuelX, 44, Math.max(8, 180 * flight.fuel / 100), 16, 8);
  ctx.fill();
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`${Math.round(flight.fuel)}%`, fuelX + 188, 58);

  // Stall and fuel warnings, flashing, below the next-ring pill. They only
  // show while flying: once the flight is over, the end screen speaks.
  if (!flight.crashed && !flight.landed && flight.stalled && Math.sin(timeSeconds * 10) > 0) {
    ctx.fillStyle = COLOURS.hudRed;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ STALL — NOSE DOWN, THROTTLE UP', VIEW.width / 2, 158);
  }
  if (!flight.crashed && !flight.landed && flight.fuel < 25 && flight.fuel > 0 && !flight.stalled) {
    ctx.fillStyle = COLOURS.hudAmber;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL — FLY THROUGH A RING', VIEW.width / 2, 158);
  }

  // Instruments, bottom left, lit.
  drawAttitude(ctx, 78, 700, 44, flight);
  drawSpeedDial(ctx, 178, 700, 44, flight);
  drawAltimeter(ctx, 278, 700, 44, flight);

  // Compass strip, bottom centre.
  drawCompass(ctx, VIEW.width / 2, 742, 340, flight);

  // Throttle lever and buttons, bottom right.
  const thrX = 1060;
  ctx.fillStyle = COLOURS.hudPanel;
  roundRect(ctx, thrX, 668, 204, 84, 12);
  ctx.fill();
  ctx.fillStyle = '#8fb8d8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THROTTLE', thrX + 14, 690);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, thrX + 14, 700, 120, 12, 6);
  ctx.fill();
  ctx.fillStyle = COLOURS.hudAmber;
  roundRect(ctx, thrX + 14, 700, Math.max(6, 120 * flight.throttle), 12, 6);
  ctx.fill();
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`${Math.round(flight.throttle * 100)}%`, thrX + 142, 712);
  // Clickable throttle buttons.
  drawButton(ctx, 'thr-down', thrX + 14, 722, 56, 22, 'THR −');
  drawButton(ctx, 'thr-up', thrX + 78, 722, 56, 22, 'THR +');
  drawButton(ctx, 'mute', thrX + 142, 722, 48, 22, 'SOUND');

  // Next-ring readout under the top bar.
  if (next) {
    const dist = Math.max(0, Math.round(next.x - flight.x));
    const dy = Math.round(next.y - flight.altitude);
    const dir = dy > 15 ? '▲ CLIMB' : dy < -15 ? '▼ DESCEND' : '— LEVEL';
    ctx.fillStyle = 'rgba(8, 18, 30, 0.6)';
    roundRect(ctx, VIEW.width / 2 - 130, 86, 260, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`NEXT RING ${next.index + 1} · ${dist}m · ${dir}`, VIEW.width / 2, 106);
  }
}

function drawButton(ctx, id, x, y, w, h, label) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 6);
  ctx.stroke();
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 4);
  addButton(id, x, y, w, h);
}

function drawBigButton(ctx, id, x, y, w, h, label) {
  ctx.save();
  ctx.shadowColor = 'rgba(255, 194, 51, 0.7)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffc233';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#2a1e00';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 7);
  addButton(id, x, y, w, h);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 18, 30, 0.82)';
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 16);
  ctx.stroke();
}

// --- Screens ---------------------------------------------------------------
function drawTitle(ctx, flight, rings, timeSeconds) {
  // The panel sits on the right so the plane on Pinecrest strip stays
  // visible on the left: the cover shot must show the aircraft, not a box.
  drawPanel(ctx, 470, 110, 700, 480);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOURS.ring;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('RIDGE RUNNER', 820, 190);
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('— Alpine Ring Run —', 820, 228);
  ctx.fillStyle = '#cfe3f2';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Take off from Pinecrest, thread all eight golden rings', 820, 272);
  ctx.fillText('over the river valley, and land gently at Alderfield.', 820, 296);
  ctx.fillText('Mind your fuel — every ring tops the tank up.', 820, 320);

  ctx.fillStyle = '#8fb8d8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('HOW TO FLY', 820, 362);
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Up / Down arrows or W / S — pitch the nose up and down', 820, 386);
  ctx.fillText('Right / Left arrows or D / A — throttle up and down', 820, 408);
  ctx.fillText('Mouse — steer toward the pointer · hold click for throttle', 820, 430);
  ctx.fillText('Space — airbrake · P — pause · M — sound on/off', 820, 452);

  // Mini course map: the whole valley on one line.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(540, 490);
  ctx.lineTo(1100, 490);
  ctx.stroke();
  ctx.fillStyle = COLOURS.runwayMark;
  ctx.fillRect(540, 483, 26, 14);
  ctx.fillRect(1074, 483, 26, 14);
  for (const ring of rings) {
    const rx = 540 + (ring.x / COURSE.lengthMetres) * 560;
    ctx.strokeStyle = COLOURS.ring;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, 490, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('PINECREST', 553, 518);
  ctx.fillText('ALDERFIELD', 1087, 518);

  drawBigButton(ctx, 'start', 720, 530, 200, 46, '▶  START FLYING');
  void timeSeconds;
  void flight;
}

function drawEndScreen(ctx, flight, rings, won, timeSeconds) {
  void timeSeconds;
  // The panel sits on the right so the aircraft and the strip stay visible
  // on the left of the shot.
  drawPanel(ctx, 480, 150, 600, 440);
  ctx.textAlign = 'center';
  if (won) {
    ctx.fillStyle = COLOURS.hudGreen;
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('MISSION COMPLETE', 780, 225);
    ctx.fillStyle = COLOURS.hudText;
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText('All eight rings, and a landing gentle enough to brag about.', 780, 262);
  } else {
    ctx.fillStyle = COLOURS.hudRed;
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('CRASHED', 780, 225);
    ctx.fillStyle = COLOURS.hudText;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(flight.crashCause || 'The valley wins this round.', 780, 262);
  }
  const timeBonus = won
    ? Math.max(0, Math.round((240 - flight.timeSeconds) * 15))
    : 0;
  const rows = [
    ['Rings flown', `${flight.ringsPassed} / ${rings.length}`],
    ['Time', formatTime(flight.timeSeconds)],
    ['Time bonus', won ? `+${timeBonus}` : '—'],
    ['Landing bonus', won ? '+2500' : '—'],
    ['Fuel left', `${Math.round(flight.fuel)}%`],
    ['SCORE', String(flight.score)],
  ];
  ctx.font = '17px system-ui, sans-serif';
  let y = 310;
  for (const [label, value] of rows) {
    ctx.fillStyle = '#8fb8d8';
    ctx.textAlign = 'right';
    ctx.fillText(label, 740, y);
    ctx.fillStyle = label === 'SCORE' ? COLOURS.hudAmber : COLOURS.hudText;
    ctx.font = label === 'SCORE' ? 'bold 22px system-ui, sans-serif' : '17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(value, 810, y);
    ctx.font = '17px system-ui, sans-serif';
    y += 30;
  }
  drawBigButton(ctx, 'restart', 680, 520, 200, 46, won ? '↻  FLY AGAIN' : '↻  TRY AGAIN');
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('or press R', 780, 580);
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(8, 18, 30, 0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', 640, 380);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Press P or click Resume to keep flying.', 640, 420);
  drawBigButton(ctx, 'resume', 540, 450, 200, 46, '▶  RESUME');
}

// --- Frame ------------------------------------------------------------------
export function drawFrame(ctx, game) {
  const { flight, rings, scenery, timeSeconds } = game;
  clearButtons();
  drawSky(ctx, timeSeconds);
  drawFarRidges(ctx, flight);
  drawClouds(ctx, flight, scenery);
  drawTerrain(ctx, flight, scenery);
  drawStrip(ctx, flight, COURSE.homeStrip, 'PINECREST');
  drawStrip(ctx, flight, COURSE.farStrip, 'ALDERFIELD');
  drawRings(ctx, flight, rings, timeSeconds);
  drawPlane(ctx, flight, timeSeconds);
  if (game.phase === 'title') {
    drawTitle(ctx, flight, rings, timeSeconds);
  } else if (game.phase === 'won' || game.phase === 'lost') {
    drawHud(ctx, flight, rings, timeSeconds);
    drawEndScreen(ctx, flight, rings, game.phase === 'won', timeSeconds);
  } else if (game.phase === 'paused') {
    drawHud(ctx, flight, rings, timeSeconds);
    drawPaused(ctx);
  } else {
    drawHud(ctx, flight, rings, timeSeconds);
  }
}

export { hitButton };
