const isTouchDevice = navigator.maxTouchPoints > 0;
const isCompactDevice = isTouchDevice || window.innerWidth <= 760;
const inferenceIntervalMs = isCompactDevice ? 85 : 60;
const pinchCloseRatio = 0.52;
const pinchReleaseRatio = 0.72;
const pinchHoldFrames = 2;
const pinchReleaseFrames = 2;
const handReadyFrames = 3;
const handSpeedMultiplier = 8;
const maxSpinSpeed = 28;
const stopSpinSpeed = 0.08;
const spinFriction = 0.984;

const stage = document.querySelector(".stage");
const carousel = document.getElementById("carousel");
const pinchHint = document.getElementById("pinchHint");
const currentCard = document.getElementById("currentCard");
const totalCards = document.getElementById("totalCards");
const statusText = document.getElementById("status");
const video = document.getElementById("camera");
const canvas = document.getElementById("overlay");
const canvasContext = canvas.getContext("2d");

let selectedIndex = 0;
let wheelPosition = 0;
let lastPalmX = null;
let lastPalmSampleTime = 0;
let pinchArmed = false;
let pinchCloseFrames = 0;
let pinchOpenFrames = 0;
let visibleHandFrames = 0;
let smoothedPinchRatio = null;
let inferenceBusy = false;
let lastInferenceTime = 0;
let lastStatus = statusText.textContent;
let pinchHintTimer = null;
let spinVelocity = 0;
let spinAnimationFrame = null;
let lastSpinFrameTime = 0;
let pointerStartX = 0;
let pointerLastX = 0;
let pointerLastTime = 0;
let pointerIsDown = false;
let pointerMoved = false;
let suppressNextClick = false;

function createFace(face, card, number) {
  const image = face === "front" ? card.frontImage : card.backImage;
  const label = face === "front" ? card.frontLabel : card.backLabel;
  const element = document.createElement("div");

  element.className = `card-face card-${face}`;

  if (image) {
    element.style.setProperty("--card-image", `url("${image}")`);
    element.classList.add("has-image");

    const photo = document.createElement("img");
    photo.className = "card-photo";
    photo.src = image;
    photo.alt = label || `Card ${number}`;
    element.append(photo);
  }

  const content = document.createElement("div");
  content.className = "card-content";

  const eyebrow = document.createElement("span");
  eyebrow.className = "card-eyebrow";
  eyebrow.textContent = face === "front" ? "CARD" : "REVEALED";

  const value = document.createElement("strong");
  value.className = "card-number";
  value.textContent = label || number;

  content.append(eyebrow, value);
  element.append(content);
  return element;
}

function buildCards() {
  const fragment = document.createDocumentFragment();

  CARD_DATA.forEach((card, index) => {
    const shell = document.createElement("article");
    const inner = document.createElement("div");
    const number = index + 1;

    shell.className = "card-shell";
    shell.dataset.index = index;
    shell.setAttribute("aria-label", `Card ${number}`);

    inner.className = "card-inner";
    inner.append(createFace("front", card, number), createFace("back", card, number));
    shell.append(inner);
    shell.addEventListener("click", () => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }

      stopSpin(true);

      if (index === selectedIndex && Math.abs(circularOffset(index)) < 0.5) {
        flipSelectedCard();
        return;
      }

      const offset = circularOffset(index);
      closeOpenCards();
      wheelPosition += offset;
      selectedIndex = index;
      renderCards();
      schedulePinchHint();
    });
    fragment.append(shell);
  });

  carousel.append(fragment);
  totalCards.textContent = CARD_DATA.length;
  renderCards();
}

function circularOffset(index) {
  const length = CARD_DATA.length;
  return ((((index - wheelPosition) + length / 2) % length) + length) % length - length / 2;
}

function renderCards() {
  const cards = carousel.querySelectorAll(".card-shell");
  selectedIndex = ((Math.round(wheelPosition) % CARD_DATA.length) + CARD_DATA.length) % CARD_DATA.length;

  cards.forEach((card, index) => {
    const offset = circularOffset(index);
    const distance = Math.abs(offset);
    const visible = distance <= 4.6;

    card.style.setProperty("--x", `${offset * 42}%`);
    card.style.setProperty("--scale", Math.max(0.62, 1 - distance * 0.105));
    card.style.setProperty("--turn", `${offset * -11}deg`);
    card.style.setProperty("--depth", `${distance * -85}px`);
    card.style.zIndex = String(Math.round(200 - distance * 10));
    card.classList.toggle("is-selected", index === selectedIndex);
    card.classList.toggle("is-hidden", !visible);
    card.setAttribute("aria-hidden", String(!visible));
  });

  currentCard.textContent = selectedIndex + 1;
  carousel.dataset.position = wheelPosition.toFixed(3);
}

function selectCard(index, announce = true) {
  const targetIndex = ((index % CARD_DATA.length) + CARD_DATA.length) % CARD_DATA.length;
  wheelPosition += circularOffset(targetIndex);
  selectedIndex = targetIndex;
  renderCards();
  if (announce) {
    setStatus(`Card ${selectedIndex + 1} selected - pinch to flip`);
  }
}

function hidePinchHint() {
  clearTimeout(pinchHintTimer);
  pinchHint.classList.remove("is-visible");
}

function schedulePinchHint() {
  hidePinchHint();

  pinchHintTimer = setTimeout(() => {
    pinchHint.classList.add("is-visible");
  }, 380);
}

function closeOpenCards() {
  carousel.querySelectorAll(".card-shell.is-flipped").forEach((card) => {
    card.classList.remove("is-flipped");
  });
}

function stopSpin(brake = false) {
  if (spinAnimationFrame !== null) {
    cancelAnimationFrame(spinAnimationFrame);
    spinAnimationFrame = null;
  }

  spinVelocity = 0;
  lastSpinFrameTime = 0;
  carousel.classList.remove("is-spinning");
  carousel.classList.add("is-settling");
  wheelPosition = Math.round(wheelPosition);
  renderCards();

  setTimeout(() => {
    carousel.classList.remove("is-settling");
  }, 340);

  if (!brake) {
    setStatus(`Card ${selectedIndex + 1} selected - pinch to flip`);
    schedulePinchHint();
  }
}

function animateSpin(time) {
  if (lastSpinFrameTime === 0) {
    lastSpinFrameTime = time;
  }

  const elapsed = Math.min((time - lastSpinFrameTime) / 1000, 0.05);
  lastSpinFrameTime = time;
  wheelPosition += spinVelocity * elapsed;
  renderCards();

  spinVelocity *= Math.pow(spinFriction, elapsed * 60);

  if (Math.abs(spinVelocity) <= stopSpinSpeed) {
    stopSpin();
    return;
  }

  spinAnimationFrame = requestAnimationFrame(animateSpin);
}

function launchSpin(velocity) {
  closeOpenCards();
  hidePinchHint();
  spinVelocity = Math.max(-maxSpinSpeed, Math.min(maxSpinSpeed, velocity));
  carousel.classList.remove("is-settling");
  carousel.classList.add("is-spinning");

  if (spinAnimationFrame === null) {
    lastSpinFrameTime = 0;
    spinAnimationFrame = requestAnimationFrame(animateSpin);
  }

  setStatus(
    Math.abs(spinVelocity) >= 8
      ? "Fast spin - hold your hand still to slow down"
      : "Rotating cards..."
  );
}

function rotateCards(direction, showHint = true) {
  stopSpin(true);
  closeOpenCards();
  hidePinchHint();
  selectCard(selectedIndex + direction);
  if (showHint) schedulePinchHint();
}

function flipSelectedCard() {
  stopSpin(true);
  hidePinchHint();
  const selected = carousel.querySelector(".card-shell.is-selected");
  if (!selected) return;

  selected.classList.toggle("is-flipped");
  setStatus(
    selected.classList.contains("is-flipped")
      ? `Card ${selectedIndex + 1} revealed`
      : `Card ${selectedIndex + 1} front`
  );
}

function setStatus(message) {
  if (message === lastStatus) return;
  lastStatus = message;
  statusText.textContent = message;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function handScale(landmarks) {
  const palmWidth = distance(landmarks[5], landmarks[17]);
  const palmLength = distance(landmarks[0], landmarks[9]);
  return Math.max(palmWidth, palmLength, 0.001);
}

function pinchRatio(landmarks) {
  const rawRatio = distance(landmarks[4], landmarks[8]) / handScale(landmarks);
  smoothedPinchRatio =
    smoothedPinchRatio === null
      ? rawRatio
      : smoothedPinchRatio * 0.45 + rawRatio * 0.55;
  return smoothedPinchRatio;
}

function isFingerExtended(landmarks, tip, pip) {
  return landmarks[tip].y < landmarks[pip].y;
}

function isOpenPalm(landmarks) {
  return (
    isFingerExtended(landmarks, 8, 6) &&
    isFingerExtended(landmarks, 12, 10) &&
    isFingerExtended(landmarks, 16, 14) &&
    isFingerExtended(landmarks, 20, 18)
  );
}

function palmCenterX(landmarks) {
  return (
    landmarks[0].x +
    landmarks[5].x +
    landmarks[9].x +
    landmarks[13].x +
    landmarks[17].x
  ) / 5;
}

function trackGesture(landmarks) {
  visibleHandFrames = Math.min(visibleHandFrames + 1, handReadyFrames);
  const currentPinchRatio = pinchRatio(landmarks);
  const handIsReady = visibleHandFrames >= handReadyFrames;

  if (currentPinchRatio <= pinchCloseRatio) {
    hidePinchHint();
    lastPalmX = null;
    lastPalmSampleTime = 0;
    pinchCloseFrames += 1;
    pinchOpenFrames = 0;

    if (handIsReady) {
      stopSpin(true);
    }

    if (handIsReady && pinchArmed && pinchCloseFrames >= pinchHoldFrames) {
      flipSelectedCard();
      pinchArmed = false;
      pinchCloseFrames = 0;
    }

    setStatus(
      !handIsReady
        ? "Hold your hand steady..."
        : pinchArmed
        ? `Hold pinch to flip card ${selectedIndex + 1}`
        : `Release fingers to pinch again`
    );
    return;
  }

  if (currentPinchRatio >= pinchReleaseRatio) {
    pinchOpenFrames += 1;
    pinchCloseFrames = 0;

    if (pinchOpenFrames >= pinchReleaseFrames) {
      pinchArmed = true;
      pinchOpenFrames = pinchReleaseFrames;
    }
  } else {
    pinchCloseFrames = 0;
    pinchOpenFrames = 0;
  }

  if (!isOpenPalm(landmarks)) {
    hidePinchHint();
    lastPalmX = null;
    lastPalmSampleTime = 0;
    setStatus("Open your palm to rotate, pinch to flip");
    return;
  }

  const palmX = 1 - palmCenterX(landmarks);
  const sampleTime = performance.now();

  if (lastPalmX === null) {
    lastPalmX = palmX;
    lastPalmSampleTime = sampleTime;
    setStatus(`Card ${selectedIndex + 1} selected - swing left or right`);
    return;
  }

  const movement = palmX - lastPalmX;
  const elapsed = Math.max((sampleTime - lastPalmSampleTime) / 1000, 0.016);
  lastPalmX = palmX;
  lastPalmSampleTime = sampleTime;

  if (Math.abs(movement) >= 0.008) {
    const measuredVelocity = (movement / elapsed) * handSpeedMultiplier;
    const smoothedVelocity = spinVelocity * 0.3 + measuredVelocity * 0.7;
    launchSpin(smoothedVelocity);
  }
}

function drawHand(results) {
  const width = video.videoWidth || canvas.clientWidth;
  const height = video.videoHeight || canvas.clientHeight;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  if (!results.multiHandLandmarks) return;

  for (const landmarks of results.multiHandLandmarks) {
    drawConnectors(canvasContext, landmarks, HAND_CONNECTIONS, {
      color: "#80ffdb",
      lineWidth: 3,
    });
    drawLandmarks(canvasContext, landmarks, {
      color: "#ffffff",
      lineWidth: 1,
      radius: 2,
    });
  }
}

function onResults(results) {
  drawHand(results);

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    lastPalmX = null;
    lastPalmSampleTime = 0;
    pinchArmed = false;
    pinchCloseFrames = 0;
    pinchOpenFrames = 0;
    visibleHandFrames = 0;
    smoothedPinchRatio = null;
    if (spinAnimationFrame === null) {
      setStatus("Show your hand - swing to rotate, pinch to flip");
    }
    return;
  }

  trackGesture(results.multiHandLandmarks[0]);
}

function startHands() {
  if (typeof Hands === "undefined" || typeof Camera === "undefined") {
    setStatus("Gesture library did not load - use arrow keys and Space");
    return;
  }

  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.62,
    minTrackingConfidence: 0.62,
  });

  hands.onResults(onResults);

  const camera = new Camera(video, {
    onFrame: async () => {
      const now = performance.now();

      if (document.hidden || inferenceBusy || now - lastInferenceTime < inferenceIntervalMs) {
        return;
      }

      inferenceBusy = true;
      lastInferenceTime = now;

      try {
        await hands.send({ image: video });
      } finally {
        inferenceBusy = false;
      }
    },
    width: isCompactDevice ? 360 : 480,
    height: isCompactDevice ? 270 : 360,
  });

  camera.start().catch(() => {
    setStatus("Camera unavailable - use arrow keys and Space");
  });
}

function startPointerControls() {
  stage.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".camera-panel")) return;

    pointerIsDown = true;
    pointerMoved = false;
    pointerStartX = event.clientX;
    pointerLastX = event.clientX;
    pointerLastTime = performance.now();
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener("pointermove", (event) => {
    if (!pointerIsDown) return;

    const now = performance.now();
    const deltaX = event.clientX - pointerLastX;
    const totalMovement = event.clientX - pointerStartX;
    const elapsed = Math.max((now - pointerLastTime) / 1000, 0.016);

    pointerLastX = event.clientX;
    pointerLastTime = now;

    if (Math.abs(totalMovement) > 10) {
      pointerMoved = true;
    }

    if (Math.abs(deltaX) >= 2) {
      const screenMovement = deltaX / Math.max(window.innerWidth, 1);
      launchSpin((screenMovement / elapsed) * handSpeedMultiplier * 1.8);
    }
  });

  function finishPointer(event) {
    if (!pointerIsDown) return;

    pointerIsDown = false;

    if (stage.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId);
    }

    if (pointerMoved) {
      suppressNextClick = true;
      setTimeout(() => {
        suppressNextClick = false;
      }, 250);
    }
  }

  stage.addEventListener("pointerup", finishPointer);
  stage.addEventListener("pointercancel", finishPointer);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    event.shiftKey ? launchSpin(24) : rotateCards(1);
  } else if (event.key === "ArrowLeft") {
    event.shiftKey ? launchSpin(-24) : rotateCards(-1);
  } else if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    flipSelectedCard();
  }
});

buildCards();
startPointerControls();
startHands();
