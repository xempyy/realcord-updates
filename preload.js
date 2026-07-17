// Store the original prototype function
const originalGetUserMedia = MediaDevices.prototype.getUserMedia;

// Apply our override to the prototype
Object.defineProperty(MediaDevices.prototype, 'getUserMedia', {
  value: async function(constraints) {
    console.log("[Realcord] Prototype intercept triggered!");

    // Apply stereo constraints
    if (constraints?.audio) {
      if (typeof constraints.audio !== 'object') constraints.audio = {};
      constraints.audio.channelCount = { ideal: 2, exact: 2 };
      constraints.audio.echoCancellation = false;
      constraints.audio.noiseSuppression = false;
      constraints.audio.autoGainControl = false;
    }

    // Call the original function
    const stream = await originalGetUserMedia.call(this, constraints);

    // Build the stereo audio graph
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const splitter = audioCtx.createChannelSplitter(2);
      const merger = audioCtx.createChannelMerger(2);
      const panner = audioCtx.createStereoPanner();

      panner.pan.value = 0.0;
      source.connect(splitter);
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 0, 1);
      merger.connect(panner);
      panner.connect(audioCtx.destination);

      window.realcordPanner = panner;
      console.log("[Realcord] Stereo graph established via prototype patch.");
    } catch (e) { console.error("[Realcord] Stereo Error:", e); }

    return stream;
  },
  configurable: false,
  writable: false
});