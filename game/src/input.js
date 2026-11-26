// Keyboard and mouse input for Ridge Runner.
//
// Keyboard: ArrowUp / W pitches the nose up, ArrowDown / S pitches down,
// ArrowRight / D opens the throttle, ArrowLeft / A closes it, Space is the
// airbrake, P pauses, M mutes, R restarts, Enter starts.
// Mouse: moving the pointer over the canvas steers the nose toward the
// pointer's height, holding the left button opens the throttle, and the
// on-screen buttons (start, restart, throttle +/-, mute) are clickable.

export function createInput(canvas) {
  const input = {
    pitchUp: false,
    pitchDown: false,
    throttleUp: false,
    throttleDown: false,
    brake: false,
    // Mouse steering: null when the pointer is off the canvas or has not
    // moved yet; otherwise the pointer's height in logical pixels.
    mouseY: null,
    mouseThrottle: false,
    // Edge-triggered actions, consumed by the game loop each frame.
    pressedStart: false,
    pressedRestart: false,
    pressedPause: false,
    pressedMute: false,
    // Clicks on canvas, in logical pixels, consumed by the game loop.
    clicks: [],
  };

  const keyMap = {
    ArrowUp: 'pitchUp',
    KeyW: 'pitchUp',
    ArrowDown: 'pitchDown',
    KeyS: 'pitchDown',
    ArrowRight: 'throttleUp',
    KeyD: 'throttleUp',
    ArrowLeft: 'throttleDown',
    KeyA: 'throttleDown',
    Space: 'brake',
  };

  window.addEventListener('keydown', (event) => {
    const field = keyMap[event.code];
    if (field) {
      input[field] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'Enter') input.pressedStart = true;
    if (event.code === 'KeyR') input.pressedRestart = true;
    if (event.code === 'KeyP' || event.code === 'Escape') input.pressedPause = true;
    if (event.code === 'KeyM') input.pressedMute = true;
  });

  window.addEventListener('keyup', (event) => {
    const field = keyMap[event.code];
    if (field) input[field] = false;
  });

  window.addEventListener('blur', () => {
    input.pitchUp = false;
    input.pitchDown = false;
    input.throttleUp = false;
    input.throttleDown = false;
    input.brake = false;
    input.mouseThrottle = false;
  });

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 800 / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  canvas.addEventListener('mousemove', (event) => {
    input.mouseY = toLogical(event).y;
  });

  canvas.addEventListener('mouseleave', () => {
    input.mouseY = null;
  });

  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.mouseThrottle = true;
      input.clicks.push(toLogical(event));
    }
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouseThrottle = false;
  });

  // The game loop calls this after reading the frame's input.
  input.consumeEdges = function consumeEdges() {
    input.pressedStart = false;
    input.pressedRestart = false;
    input.pressedPause = false;
    input.pressedMute = false;
    input.clicks.length = 0;
  };

  return input;
}
