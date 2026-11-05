/* Jan-Ken camera controls: on-device hand gesture recognition (MediaPipe Gesture Recognizer).
   Video never leaves the device. Fist = ROCK, open palm = PAPER, V sign = SCISSORS. */
(function () {
  const JK = (window.JK = window.JK || {});
  const VER = '0.10.14';
  const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
  const MODELS = ['https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task', 'https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task'];
  const MAP = { Closed_Fist: 'rock', Open_Palm: 'paper', Victory: 'scissors' };
  const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

  const Cam = (JK.Cam = { on: false, ready: false, busy: false, stream: null, rec: null, faceRec: null, gesture: null, since: 0, raw: null, rawSince: 0, landmarks: null, last: 0, face: { ex: 'neutral', tilt: 0 }, faceCand: null, faceN: 0, turn: 0 });

  Cam.supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false;

  async function openStream() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    const v = document.getElementById('camVideo');
    v.srcObject = stream; v.muted = true; v.playsInline = true;
    await v.play();
    Cam.stream = stream; Cam.video = v;
  }
  async function loadModel() {
    let vision;
    try { vision = await import(`${BASE}/vision_bundle.mjs`); } catch (e) { vision = await import(`${BASE}/+esm`); }
    const files = await vision.FilesetResolver.forVisionTasks(`${BASE}/wasm`);
    const make = (model, delegate) => vision.GestureRecognizer.createFromOptions(files, { baseOptions: { modelAssetPath: model, delegate }, runningMode: 'VIDEO', numHands: 1 });
    let err;
    for (const model of MODELS) { for (const d of ['GPU', 'CPU']) { try { Cam.rec = await make(model, d); break; } catch (e) { err = e; } } if (Cam.rec) break; }
    if (!Cam.rec) throw err;
    // face expressions are a bonus: if the face model fails, hand controls still work
    for (const d of ['GPU', 'CPU']) {
      try { Cam.faceRec = await vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate: d }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true }); break; } catch (e) {}
    }
  }

  /* start (or resume) the camera; status(msg) reports progress */
  Cam.start = async function (status) {
    if (Cam.on) return true;
    if (!Cam.supported()) throw new Error('This page cannot use the camera here. Open the game from its https:// address in Chrome, Edge, Safari or Firefox.');
    if (Cam.busy) return false;
    Cam.busy = true;
    try {
      status && status('ALLOW CAMERA ACCESS...');
      await openStream();
      if (!Cam.rec) { status && status('LOADING HAND TRACKING...'); await loadModel(); }
      Cam.ready = true; Cam.on = true; Cam.gesture = null;
      requestAnimationFrame(loop);
      return true;
    } catch (e) {
      Cam.stop();
      const msg = e && e.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow the camera for this site in your browser settings and try again.'
        : e && e.name === 'NotFoundError' ? 'No camera was found on this device.'
        : 'Hand tracking could not load. Check your internet connection and try again.';
      throw new Error(msg);
    } finally { Cam.busy = false; }
  };
  Cam.stop = function () {
    Cam.on = false; Cam.gesture = null; Cam.raw = null; Cam.landmarks = null; Cam.face = { ex: 'neutral', tilt: 0 };
    if (Cam.stream) Cam.stream.getTracks().forEach((t) => t.stop());
    Cam.stream = null;
  };
  /* how long (ms) the current gesture has been held steady */
  Cam.held = () => (Cam.gesture ? performance.now() - Cam.since : 0);

  function loop() {
    if (!Cam.on) return;
    const v = Cam.video, now = performance.now();
    if (v && v.readyState >= 2 && now - Cam.last > 60 && v.currentTime !== Cam.vt) {
      Cam.last = now; Cam.vt = v.currentTime;
      Cam.turn++;
      try {
        if (Cam.turn % 2 || !Cam.faceRec) {
          const r = Cam.rec.recognizeForVideo(v, now);
          const g = r.gestures && r.gestures[0] && r.gestures[0][0];
          const name = g && g.score > 0.55 ? g.categoryName : null;
          const choice = name ? MAP[name] || null : null;
          if (choice !== Cam.gesture) { Cam.gesture = choice; Cam.since = now; }
          if (name !== Cam.raw) { Cam.raw = name; Cam.rawSince = now; }
          Cam.landmarks = r.landmarks && r.landmarks[0] ? r.landmarks[0] : null;
        } else {
          const r = Cam.faceRec.detectForVideo(v, now);
          readFace(r);
        }
      } catch (e) {}
    }
    requestAnimationFrame(loop);
  }

  /* blendshapes -> fighter expression (debounced), eye line -> head tilt */
  function readFace(r) {
    const cats = r && r.faceBlendshapes && r.faceBlendshapes[0] && r.faceBlendshapes[0].categories;
    if (!cats) { Cam.faceCand = 'neutral'; Cam.faceN = 0; Cam.face = { ex: 'neutral', tilt: 0 }; return; }
    const b = {}; cats.forEach((c) => (b[c.categoryName] = c.score));
    const avg = (x, y) => ((b[x] || 0) + (b[y] || 0)) / 2;
    const smile = avg('mouthSmileLeft', 'mouthSmileRight'), jaw = b.jawOpen || 0, browDown = avg('browDownLeft', 'browDownRight');
    const browUp = b.browInnerUp || 0, blink = avg('eyeBlinkLeft', 'eyeBlinkRight');
    let ex = 'neutral';
    if (blink > 0.55) ex = 'blink';
    else if (jaw > 0.45 && browUp > 0.35) ex = 'surprised';
    else if (jaw > 0.45) ex = 'shout';
    else if (smile > 0.45) ex = 'win';
    else if (browDown > 0.4) ex = 'fierce';
    if (ex === Cam.faceCand) Cam.faceN++; else { Cam.faceCand = ex; Cam.faceN = 1; }
    let tilt = Cam.face.tilt;
    const lm = r.faceLandmarks && r.faceLandmarks[0];
    if (lm && lm[33] && lm[263]) { const roll = (Math.atan2(lm[263].y - lm[33].y, lm[263].x - lm[33].x) * 180) / Math.PI; tilt = Math.max(-20, Math.min(20, -roll * 0.9)); }
    Cam.face = { ex: Cam.faceN >= 2 || ex === 'blink' ? ex : Cam.face.ex, tilt };
  }

  /* draw the mirrored preview + hand skeleton into a canvas */
  const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
  Cam.draw = function (cv, color) {
    const c = cv.getContext('2d'), w = cv.width, h = cv.height, v = Cam.video;
    c.clearRect(0, 0, w, h);
    if (!v || v.readyState < 2) return;
    const vw = v.videoWidth, vh = v.videoHeight, sc = Math.max(w / vw, h / vh), dw = vw * sc, dh = vh * sc;
    c.save(); c.translate(w, 0); c.scale(-1, 1);
    c.drawImage(v, (w - dw) / 2, (h - dh) / 2, dw, dh);
    if (Cam.landmarks) {
      const P = (p) => [(w - dw) / 2 + p.x * dw, (h - dh) / 2 + p.y * dh];
      c.strokeStyle = color || '#3ef0ff'; c.lineWidth = Math.max(2, w / 120); c.lineCap = 'round';
      BONES.forEach(([a, b]) => { const A = P(Cam.landmarks[a]), B = P(Cam.landmarks[b]); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); });
      c.fillStyle = '#ffffff'; Cam.landmarks.forEach((p) => { const q = P(p); c.beginPath(); c.arc(q[0], q[1], Math.max(2, w / 110), 0, 7); c.fill(); });
    }
    c.restore();
  };
})();
