// =========================================================================
// PROXY-BASED MEDIA INTERCEPTION (The "Shield" Method)
// =========================================================================

// Store the reference to the original native function
const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

const handler = {
  get(target, prop, receiver) {
    if (prop === 'getUserMedia') {
      return async function(constraints) {
        console.log("[Realcord] Proxy Intercept: getUserMedia called!");
        
        // Prepare constraints for stereo
        if (constraints && constraints.audio) {
          if (typeof constraints.audio === "boolean") constraints.audio = {};
          constraints.audio.channelCount = { ideal: 2, exact: 2 };
          constraints.audio.echoCancellation = false;
          constraints.audio.noiseSuppression = false;
          constraints.audio.autoGainControl = false;
        }

        const stream = await nativeGetUserMedia.call(target, constraints);

        // Apply AudioContext stereo graph
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
          console.log("[Realcord] Stereo graph attached via Proxy.");
        } catch (e) { console.error("[Realcord] Stereo Error:", e); }

        return stream;
      };
    }
    return Reflect.get(target, prop, receiver);
  }
};

// Apply the Proxy shield to the mediaDevices object
navigator.mediaDevices = new Proxy(navigator.mediaDevices, handler);

console.log("[Realcord] MediaDevices Proxy shield initialized.");