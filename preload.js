// =========================================================================
// PURE STEREO ROUTING ONLY
// =========================================================================
const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

navigator.mediaDevices.getUserMedia = async function (constraints) {
  console.log("[Realcord] Intercepting mic for stereo routing...");

  // Force Chrome/Electron to request 2 input channels
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
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000
    });

    // Force the output destination to strictly process 2 discrete channels
    audioCtx.destination.channelCount = 2;
    audioCtx.destination.channelCountMode = "explicit";
    audioCtx.destination.channelInterpretation = "speakers";

    const source = audioCtx.createMediaStreamSource(stream);
    
    // Create a channel splitter and merger to duplicate the mono mic into Left & Right
    const splitter = audioCtx.createChannelSplitter(2);
    const merger = audioCtx.createChannelMerger(2);

    // Connect Mono Channel 0 to both Left and Right output slots
    source.connect(splitter);
    splitter.connect(merger, 0, 0); // Mic input -> Left channel
    splitter.connect(merger, 0, 1); // Mic input -> Right channel

    // Add the Stereo Panner Node to control the balance
    const panner = audioCtx.createStereoPanner();
    panner.pan.value = 0.0; // Center by default

    // Connect: Duplicated Stereo -> Panner -> Destination
    merger.connect(panner);
    panner.connect(audioCtx.destination);

    // Expose the panner to the console so we can control it manually
    window.realcordPanner = panner;

    console.log("[Realcord] Stereo channel routing successfully configured.");
  } catch (err) {
    console.error("[Realcord] Error setting up stereo routing:", err);
  }

  return stream;
};