const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

navigator.mediaDevices.getUserMedia = async function (constraints) {
  console.log("[Realcord] Intercepting mic for stereo routing...");

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

    audioCtx.destination.channelCount = 2;
    audioCtx.destination.channelCountMode = "explicit";
    audioCtx.destination.channelInterpretation = "speakers";

    const source = audioCtx.createMediaStreamSource(stream);
    
    const splitter = audioCtx.createChannelSplitter(2);
    const merger = audioCtx.createChannelMerger(2);

    source.connect(splitter);
    splitter.connect(merger, 0, 0); 
    splitter.connect(merger, 0, 1); 

    const panner = audioCtx.createStereoPanner();
    panner.pan.value = 0.0; 

    merger.connect(panner);
    panner.connect(audioCtx.destination);

    window.realcordPanner = panner;

    console.log("[Realcord] Stereo routing active. window.realcordPanner is ready!");
  } catch (err) {
    console.error("[Realcord] Error setting up stereo routing:", err);
  }

  return stream;
};