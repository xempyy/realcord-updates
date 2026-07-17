// Immediately define a custom mediaDevices object before Discord touches it
const originalMediaDevices = navigator.mediaDevices;

const customMediaDevices = {
  getUserMedia: async function(constraints) {
    console.log("[Realcord] Intercepting via custom boot-hook...");
    
    // Setup for 2 channels
    if (constraints?.audio) {
      if (typeof constraints.audio !== 'object') constraints.audio = {};
      constraints.audio.channelCount = { ideal: 2, exact: 2 };
      constraints.audio.echoCancellation = false;
      constraints.audio.noiseSuppression = false;
      constraints.audio.autoGainControl = false;
    }

    const stream = await originalMediaDevices.getUserMedia(constraints);
    
    // Set up stereo routing
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const splitter = audioCtx.createChannelSplitter(2);
      const merger = audioCtx.createChannelMerger(2);
      const panner = audioCtx.createStereoPanner();

      source.connect(splitter);
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 0, 1);
      merger.connect(panner);
      panner.connect(audioCtx.destination);

      window.realcordPanner = panner;
      console.log("[Realcord] Stereo stream established.");
    } catch (e) { console.error(e); }

    return stream;
  },
  enumerateDevices: () => originalMediaDevices.enumerateDevices(),
  getDisplayMedia: (c) => originalMediaDevices.getDisplayMedia(c),
  addEventListener: (t, l) => originalMediaDevices.addEventListener(t, l),
  removeEventListener: (t, l) => originalMediaDevices.removeEventListener(t, l)
};

// Force the override
Object.defineProperty(navigator, 'mediaDevices', {
  value: customMediaDevices,
  writable: false,
  configurable: false
});