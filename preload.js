// ==========================================
// GLOBALS & STATE (Pre-initialized)
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
const gainNode = audioCtx.createGain();
const pannerNode = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : audioCtx.createPanner();

if (audioCtx.createStereoPanner) {
  pannerNode.pan.value = 0; // Center
}

// 10-Band EQ frequencies
const eqFrequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const eqFilters = eqFrequencies.map((freq) => {
  const filter = audioCtx.createBiquadFilter();
  filter.type = "peaking";
  filter.frequency.value = freq;
  filter.Q.value = 1.0;
  filter.gain.value = 0; // Flat
  return filter;
});

const audioDestination = audioCtx.createMediaStreamDestination();

// State tracking for mic source routing
let micSource = null;

// MP3 Soundboard Nodes
let mp3AudioElement = null;
let mp3Source = null;

// Build static effect chain immediately
// Gain -> EQ Chain -> Panner -> Destination
let lastNode = gainNode;
eqFilters.forEach(filter => {
  lastNode = lastNode.connect(filter);
});
lastNode.connect(pannerNode);
pannerNode.connect(audioDestination);

// Build MP3 routing immediately
setupMp3Routing();

// ==========================================
// 1. STEREO WEBAUDIO ROUTING & EFFECT CHAIN
// ==========================================
const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

navigator.mediaDevices.getUserMedia = async function(constraints) {
  if (constraints.audio) {
    // Force raw stereo streams with zero hardware filtering
    constraints.audio = {
      channelCount: { exact: 2 },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    };

    try {
      const realMicStream = await originalGetUserMedia(constraints);
      console.log("[AudioClient] Captured raw stereo stream from hardware.");

      // Resume context if suspended by browser security policy
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // Disconnect old microphone source if it exists to prevent overlap leaks
      if (micSource) {
        try { micSource.disconnect(); } catch(e){}
      }

      // Connect New Mic -> Gain Node (Which is already chained to EQ, Panner & Outbound)
      micSource = audioCtx.createMediaStreamSource(realMicStream);
      micSource.connect(gainNode);

      // Return processed high-fidelity stereo stream straight to Discord
      return audioDestination.stream;

    } catch (err) {
      console.error("[AudioClient] Web Audio configuration failed. Falling back.", err);
      return originalGetUserMedia(constraints);
    }
  }
  return originalGetUserMedia(constraints);
};

// Hooks up the custom MP3 file player to inject audio directly into Discord's outbound feed
function setupMp3Routing() {
  if (!mp3AudioElement) {
    mp3AudioElement = document.createElement('audio');
    mp3AudioElement.crossOrigin = "anonymous";
    mp3AudioElement.loop = false;
  }
  
  if (audioCtx && !mp3Source) {
    mp3Source = audioCtx.createMediaElementSource(mp3AudioElement);
    // Connect MP3 straight into the Panner so it moves with the pan slider
    mp3Source.connect(pannerNode);
  }
}

// ==========================================
// 2. DISCORD MODAL SIDEBAR BUTTON INJECTOR
// ==========================================
const observer = new MutationObserver(() => {
  if (document.getElementById('audio-controller-tab')) return;

  const allElements = Array.from(document.querySelectorAll('*'));
  const targetHeaderNode = allElements.find(el => {
    const text = el.textContent.trim();
    return text === 'Activity Privacy' || text === 'Activity';
  });

  if (targetHeaderNode) {
    const targetItem = targetHeaderNode.closest('[role="tab"]') || targetHeaderNode.parentElement;
    const sidebar = targetItem.parentElement;

    if (sidebar) {
      const divider = document.createElement('div');
      divider.id = 'audio-controller-divider';
      divider.style.height = '1px';
      divider.style.backgroundColor = 'rgba(79, 84, 92, 0.24)';
      divider.style.margin = '8px 10px';

      const tabBtn = document.createElement('div');
      tabBtn.id = 'audio-controller-tab';
      tabBtn.setAttribute('role', 'tab');
      
      tabBtn.style.padding = '6px 10px';
      tabBtn.style.margin = '2px 8px';
      tabBtn.style.borderRadius = '4px';
      tabBtn.style.cursor = 'pointer';
      tabBtn.style.color = '#b5bac1';
      tabBtn.style.fontSize = '14px';
      tabBtn.style.fontWeight = '500';
      tabBtn.style.fontFamily = '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';
      tabBtn.innerHTML = '🎛️ Audio Controller (Stereo)';

      tabBtn.onmouseenter = () => {
        tabBtn.style.backgroundColor = 'rgba(79, 84, 92, 0.3)';
        tabBtn.style.color = '#dbdee1';
      };
      tabBtn.onmouseleave = () => {
        tabBtn.style.backgroundColor = 'transparent';
        tabBtn.style.color = '#b5bac1';
      };

      tabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openStandaloneControllerWindow();
      });

      sidebar.insertBefore(divider, targetItem);
      sidebar.insertBefore(tabBtn, targetItem);
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  observer.observe(document.body, { childList: true, subtree: true });
});

// ==========================================
// 3. STANDALONE FLOATING OVERLAY WINDOW SYSTEM
// ==========================================
function openStandaloneControllerWindow() {
  const existingWindow = document.getElementById('audio-controller-window');
  if (existingWindow) {
    existingWindow.style.transform = 'scale(1.02)';
    setTimeout(() => existingWindow.style.transform = 'scale(1)', 150);
    return;
  }

  const win = document.createElement('div');
  win.id = 'audio-controller-window';
  win.style.position = 'fixed';
  win.style.top = '100px';
  win.style.left = '100px';
  win.style.width = '480px';
  win.style.backgroundColor = '#1e1f22';
  win.style.border = '1px solid #35363c';
  win.style.borderRadius = '12px';
  win.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';
  win.style.zIndex = '99999';
  win.style.fontFamily = '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';
  win.style.display = 'flex';
  win.style.flexDirection = 'column';
  win.style.overflow = 'hidden';
  win.style.transition = 'transform 0.1s ease';

  const titlebar = document.createElement('div');
  titlebar.style.padding = '12px 16px';
  titlebar.style.backgroundColor = '#2b2d31';
  titlebar.style.display = 'flex';
  titlebar.style.justifyContent = 'space-between';
  titlebar.style.alignItems = 'center';
  titlebar.style.cursor = 'move';
  titlebar.style.userSelect = 'none';
  titlebar.style.borderBottom = '1px solid #35363c';

  titlebar.innerHTML = `
    <span style="color: #ffffff; font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px;">🎛️ Audio Controller</span>
    <button id="close-audio-window" style="background: none; border: none; color: #949ba4; font-size: 18px; cursor: pointer; padding: 0 4px; line-height: 1;">&times;</button>
  `;

  const content = document.createElement('div');
  content.style.padding = '20px';
  content.style.maxHeight = '520px';
  content.style.overflowY = 'auto';
  content.style.boxSizing = 'border-box';

  content.innerHTML = `
    <!-- STEREO PANNER SECTION -->
    <div style="background: #2b2d31; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.05);">
      <h3 style="color: #ffffff; font-size: 13px; margin: 0 0 4px 0; font-weight: 600;">🎧 Stereo Panning</h3>
      <p style="font-size: 11px; color: #949ba4; margin: 0 0 12px 0;">Slide to move voice/MP3. Double click slider to center.</p>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 11px; font-weight: bold; color: #949ba4;">L</span>
        <input type="range" min="-1" max="1" step="0.05" value="${pannerNode && pannerNode.pan ? pannerNode.pan.value : 0}" id="pan-slider" style="flex: 1; accent-color: #5865f2; cursor: pointer; height: 6px; border-radius: 3px;">
        <span style="font-size: 11px; font-weight: bold; color: #949ba4;">R</span>
      </div>
      <div id="pan-value" style="text-align: center; font-size: 11px; color: #5865f2; margin-top: 8px; font-weight: 600; text-transform: uppercase;">Centered</div>
    </div>

    <!-- GAIN CONTROL -->
    <div style="background: #2b2d31; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.05);">
      <h3 style="color: #ffffff; font-size: 13px; margin: 0 0 4px 0; font-weight: 600;">🔊 Mic Booster</h3>
      <p style="font-size: 11px; color: #949ba4; margin: 0 0 12px 0;">Boost or dim your output level.</p>
      <input type="range" min="0" max="10" step="0.1" value="${gainNode ? gainNode.gain.value : 1}" id="gain-slider" style="width: 100%; accent-color: #5865f2; cursor: pointer; height: 6px; border-radius: 3px;">
      <div id="gain-value" style="text-align: right; font-size: 11px; margin-top: 6px; font-weight: 600; color: #b5bac1;">${gainNode ? gainNode.gain.value.toFixed(1) : '1.0'}x</div>
    </div>

    <!-- MP3 PLAYER -->
    <div style="background: #2b2d31; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.05);">
      <h3 style="color: #ffffff; font-size: 13px; margin: 0 0 4px 0; font-weight: 600;">🎵 Soundboard Injection</h3>
      <p style="font-size: 11px; color: #949ba4; margin: 0 0 12px 0;">Inject local MP3s directly into the call.</p>
      <input type="file" id="mp3-file" accept="audio/mp3" style="width: 100%; font-size: 11px; background: #1e1f22; padding: 8px; border-radius: 4px; border: 1px dashed rgba(255,255,255,0.1); color: #b5bac1; box-sizing: border-box; cursor: pointer;">
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button id="btn-play-mp3" style="background: #248046; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">Play</button>
        <button id="btn-pause-mp3" style="background: #da373c; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">Pause</button>
      </div>
    </div>

    <!-- 10-BAND EQ -->
    <div style="background: #2b2d31; padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
      <h3 style="color: #ffffff; font-size: 13px; margin: 0 0 4px 0; font-weight: 600;">📊 Frequency Equalizer</h3>
      <p style="font-size: 11px; color: #949ba4; margin-bottom: 16px;">Fine tune frequencies from Sub-Bass to Treble.</p>
      <div style="display: flex; justify-content: space-between; height: 110px;">
        ${[31, 62, 125, 250, 500, '1k', '2k', '4k', '8k', '16k'].map((freq, idx) => `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; height: 100%;">
            <span style="font-size: 8px; color: #949ba4;">+12</span>
            <input type="range" orient="vertical" min="-12" max="12" value="${eqFilters[idx] ? eqFilters[idx].gain.value : 0}" data-band="${idx}" class="eq-slider" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 6px; height: 70px; accent-color: #5865f2; cursor: pointer;">
            <span style="font-size: 8px; color: #949ba4;">-12</span>
            <span style="font-size: 9px; font-weight: 600; color: #dbdee1;">${freq}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  win.appendChild(titlebar);
  win.appendChild(content);
  document.body.appendChild(win);

  // Close Action
  document.getElementById('close-audio-window').addEventListener('click', () => {
    win.remove();
  });

  // Enable dragging on Titlebar
  let isDragging = false;
  let offsetX, offsetY;

  titlebar.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - win.offsetLeft;
    offsetY = e.clientY - win.offsetTop;
    titlebar.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    win.style.left = `${e.clientX - offsetX}px`;
    win.style.top = `${e.clientY - offsetY}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    titlebar.style.cursor = 'move';
  });

  // Hook Up Controls
  attachUIEvents();
}

function attachUIEvents() {
  // 1. Stereo Pan Slider Logic
  const panSlider = document.getElementById('pan-slider');
  const panValueText = document.getElementById('pan-value');
  
  if (pannerNode && panSlider) {
    panSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (pannerNode.pan) {
        pannerNode.pan.value = val;
      }
      
      if (val === 0) panValueText.innerText = "Centered";
      else if (val < 0) panValueText.innerText = `Panned Left (${Math.abs(Math.round(val * 100))}%)`;
      else panValueText.innerText = `Panned Right (${Math.round(val * 100)}%)`;
    });

    panSlider.addEventListener('dblclick', () => {
      panSlider.value = 0;
      if (pannerNode.pan) pannerNode.pan.value = 0;
      panValueText.innerText = "Centered";
    });
  }

  // 2. Gain Booster Slider Logic
  const gainSlider = document.getElementById('gain-slider');
  const gainValueText = document.getElementById('gain-value');
  
  if (gainNode && gainSlider) {
    gainSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      gainNode.gain.value = val;
      gainValueText.innerText = `${val.toFixed(1)}x ${val > 1 ? '(Boosted)' : ''}`;
    });
  }

  // 3. MP3 Selection and Playback Logic
  const fileInput = document.getElementById('mp3-file');
  const playBtn = document.getElementById('btn-play-mp3');
  const pauseBtn = document.getElementById('btn-pause-mp3');

  if (fileInput && playBtn && pauseBtn) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && mp3AudioElement) {
        mp3AudioElement.src = URL.createObjectURL(file);
        setupMp3Routing();
      }
    });

    playBtn.addEventListener('click', async () => {
      if (mp3AudioElement) {
        await audioCtx.resume();
        mp3AudioElement.play();
      }
    });

    pauseBtn.addEventListener('click', () => {
      mp3AudioElement?.pause();
    });
  }

  // 4. Equalizer 10-Band Sliders Logic
  const eqSliders = document.querySelectorAll('.eq-slider');
  eqSliders.forEach(slider => {
    slider.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-band'));
      const val = parseFloat(e.target.value);
      if (eqFilters[idx]) {
        eqFilters[idx].gain.value = val;
      }
    });
  });
}

(function() {
    // 1. A helper function to modify the SDP string
    function forceStereoInSDP(sdp) {
        if (!sdp) return sdp;

        const lines = sdp.split('\r\n');
        let opusPayloadType = null;

        // Find the Opus codec payload type (usually looks like: a=rtpmap:111 opus/48000/2)
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('opus/48000/2')) {
                const match = lines[i].match(/a=rtpmap:(\d+)\s+opus\/48000\/2/);
                if (match) {
                    opusPayloadType = match[1];
                }
                break;
            }
        }

        // If Opus is found, find its corresponding fmtp configuration line and append stereo settings
        if (opusPayloadType) {
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith(`a=fmtp:${opusPayloadType}`)) {
                    // Avoid appending repeatedly if already patched
                    if (!lines[i].includes('stereo=1')) {
                        // We append stereo parameters and raise the target bitrate (e.g., 510kbps)
                        lines[i] = lines[i] + ';stereo=1;sprop-stereo=1;maxaveragebitrate=510000;cbr=1';
                    }
                    break;
                }
            }
        }

        return lines.join('\r\n');
    }

    // 2. Intercept RTCPeerConnection functions
    const OriginalRTCPeerConnection = window.RTCPeerConnection;

    window.RTCPeerConnection = function(config, constraints) {
        const pc = new OriginalRTCPeerConnection(config, constraints);

        // Hook setLocalDescription to catch outbound audio configuration
        const originalSetLocalDescription = pc.setLocalDescription;
        pc.setLocalDescription = function(desc) {
            if (desc && desc.sdp) {
                desc.sdp = forceStereoInSDP(desc.sdp);
            }
            return originalSetLocalDescription.apply(this, arguments);
        };

        // Hook setRemoteDescription to catch inbound audio configuration
        const originalSetRemoteDescription = pc.setRemoteDescription;
        pc.setRemoteDescription = function(desc) {
            if (desc && desc.sdp) {
                desc.sdp = forceStereoInSDP(desc.sdp);
            }
            return originalSetRemoteDescription.apply(this, arguments);
        };

        return pc;
    };

    // Copy static properties to our overridden constructor to prevent breakages
    Object.setPrototypeOf(window.RTCPeerConnection, OriginalRTCPeerConnection);
    if (OriginalRTCPeerConnection.prototype) {
        window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
    }

    console.log('[Stereo Injection] WebRTC SDP interceptor successfully initialized.');
})();

// =========================================================================
// REALCORD STEREO AUDIO INJECTION
// Intercepts and overrides Discord's microphone capture to force stereo
// =========================================================================

if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  navigator.mediaDevices.getUserMedia = async function (constraints) {
    if (constraints && constraints.audio) {
      console.log('[Realcord] Intercepted getUserMedia. Forcing stereo audio constraints...');

      // Force stereo parameters and disable aggressive mono-forcing filters
      constraints.audio = {
        channelCount: { ideal: 2, min: 2 }, // Force 2 channels (Stereo)
        echoCancellation: false,             // Disable echo cancellation (forces mono)
        noiseSuppression: false,             // Disable noise suppression (forces mono)
        autoGainControl: false,              // Disable auto gain
        highpassFilter: false,               // Disable highpass filter
        typingNoiseDetection: false          // Disable typing noise removal
      };
    }
    return originalGetUserMedia(constraints);
  };
  console.log('[Realcord] Stereo audio hook successfully injected.');
}