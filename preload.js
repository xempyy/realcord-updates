// Keep track of the active media stream handler
let realGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

// =========================================================================
// CUSTOM STEREO STREAM HANDLER
// =========================================================================
async function applyStereoRouting(constraints) {
  console.log("[Realcord] Custom audio graph handler triggered!");

  // Apply custom stereo and bypass standard Discord compression constraints
  if (constraints && constraints.audio) {
    if (typeof constraints.audio === "boolean") {
      constraints.audio = {};
    }
    constraints.audio.channelCount = { ideal: 2, exact: 2 };
    constraints.audio.echoCancellation = false;
    constraints.audio.noiseSuppression = false;
    constraints.audio.autoGainControl = false;
  }

  // Safely call Discord's wrapper (or native getUserMedia) with correct 'this' context
  const stream = await realGetUserMedia.call(navigator.mediaDevices, constraints);

  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000
    });

    // Force output destination to process 2 discrete channels
    audioCtx.destination.channelCount = 2;
    audioCtx.destination.channelCountMode = "explicit";
    audioCtx.destination.channelInterpretation = "speakers";

    const source = audioCtx.createMediaStreamSource(stream);
    
    // Split the mono mic stream and duplicate it to Left (0) and Right (1)
    const splitter = audioCtx.createChannelSplitter(2);
    const merger = audioCtx.createChannelMerger(2);

    source.connect(splitter);
    splitter.connect(merger, 0, 0); // Mono Source -> Left channel
    splitter.connect(merger, 0, 1); // Mono Source -> Right channel

    // Connect merged stereo output to the Panner Node
    const panner = audioCtx.createStereoPanner();
    panner.pan.value = 0.0; // Centered by default

    merger.connect(panner);
    panner.connect(audioCtx.destination);

    // Save panner to the global window for easy console testing
    window.realcordPanner = panner;

    console.log("[Realcord] Stereo routing active! window.realcordPanner is now ready.");
  } catch (err) {
    console.error("[Realcord] Failed to build Web Audio stereo graph:", err);
  }

  return stream;
}

// =========================================================================
// BULLETPROOF GETTER/SETTER HOOKS
// =========================================================================
const patchTargets = [navigator.mediaDevices, Object.getPrototypeOf(navigator.mediaDevices)];

patchTargets.forEach(target => {
  if (!target) return;
  
  try {
    Object.defineProperty(target, 'getUserMedia', {
      configurable: true,
      enumerable: true,
      get() {
        return applyStereoRouting;
      },
      set(discordWrapper) {
        console.log("[Realcord] Intercepted Discord trying to overwrite getUserMedia! Hooking wrapper...");
        realGetUserMedia = discordWrapper;
      }
    });
  } catch (e) {
    console.error("[Realcord] Failed to apply target hook:", e);
  }
});