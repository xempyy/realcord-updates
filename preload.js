// This attempts to hook into Discord's internal audio dispatcher
window.webpackChunkdiscord_app.push([
  [Math.random()],
  {},
  (req) => {
    for (const m of Object.keys(req.c)) {
      const module = req.c[m].exports;
      if (module?.default?.getMediaEngine) {
        const mediaEngine = module.default.getMediaEngine();
        
        // Intercept the internal setOutputVolume or similar engine methods
        if (mediaEngine.setAudioSource) {
          console.log("[Realcord] Found MediaEngine! Attempting patch...");
          
          const originalSetSource = mediaEngine.setAudioSource.bind(mediaEngine);
          mediaEngine.setAudioSource = async function(source) {
            console.log("[Realcord] Intercepted internal audio source.");
            return originalSetSource(source);
          };
        }
      }
    }
  }
]);