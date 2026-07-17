// =========================================================================
// 1. FORCE STEREO & WEBAUDIO PATCH
// =========================================================================
const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

navigator.mediaDevices.getUserMedia = async function (constraints) {
  console.log("[Realcord] Intercepting getUserMedia constraints:", constraints);

  // Force stereo and high-quality audio flags in the media constraints
  if (constraints && constraints.audio) {
    if (typeof constraints.audio === "boolean") {
      constraints.audio = {};
    }
    constraints.audio.channelCount = { ideal: 2, exact: 2 };
    constraints.audio.echoCancellation = false;
    constraints.audio.noiseSuppression = false;
    constraints.audio.autoGainControl = false;
  }

  const stream = await originalGetUserMedia(constraints);
  
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: "interactive",
      sampleRate: 48000
    });

    // Manually force the pipeline destination to support 2 channels (Stereo)
    if (audioContext.destination) {
      audioContext.destination.channelCount = 2;
      audioContext.destination.channelCountMode = "explicit";
      audioContext.destination.channelInterpretation = "speakers";
    }

    const source = audioContext.createMediaStreamSource(stream);
    
    // Create a manual Stereo Panner Node and Gain Node
    const panner = audioContext.createStereoPanner();
    const gainNode = audioContext.createGain();

    panner.pan.value = 0.0; // Center by default
    gainNode.gain.value = 1.0; // Standard gain

    // Expose these nodes globally to the window so our controllers can reach them
    window.realcordPanner = panner;
    window.realcordGain = gainNode;
    window.realcordAudioContext = audioContext;

    // Connect the nodes: Source -> Panner -> Gain -> Destination
    source.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(audioContext.destination);

    console.log("[Realcord] Stereo Web Audio routing established successfully.");
  } catch (err) {
    console.error("[Realcord] Failed to construct custom audio graph:", err);
  }

  return stream;
};