// Location Alarm App (Leaflet + Geolocation + Vibration + Audio + PWA)

let map, userMarker, accuracyCircle, destMarker, destCircle;
let watchId = null;
let armed = false;
let triggered = false;
let vibrateTimer = null;
let wakeLock = null;

const state = {
  radius: parseInt(localStorage.getItem("radius") || "500", 10),
  dest: null, // {lat, lng}
};

const els = {
  radius: document.getElementById("radius"),
  radiusNum: document.getElementById("radiusNum"),
  armBtn: document.getElementById("armBtn"),
  stopBtn: document.getElementById("stopBtn"),
  gpsStatus: document.getElementById("gpsStatus"),
  distanceText: document.getElementById("distanceText"),
  insideText: document.getElementById("insideText"),
  audioFile: document.getElementById("audioFile"),
  alarmAudio: document.getElementById("alarmAudio"),
  wakeLockToggle: document.getElementById("wakeLockToggle"),
  installBtn: document.getElementById("installBtn"),
};

// Sync radius inputs
els.radius.value = state.radius;
els.radiusNum.value = state.radius;
["change","input"].forEach(ev => {
  els.radius.addEventListener(ev, () => {
    state.radius = parseInt(els.radius.value, 10);
    els.radiusNum.value = state.radius;
    localStorage.setItem("radius", String(state.radius));
    drawDestCircle();
  });
  els.radiusNum.addEventListener(ev, () => {
    state.radius = Math.max(50, Math.min(5000, parseInt(els.radiusNum.value || "500", 10)));
    els.radius.value = state.radius;
    localStorage.setItem("radius", String(state.radius));
    drawDestCircle();
  });
});

// Init map
function initMap() {
  map = L.map("map");
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
  }).addTo(map);

  // Geocoder (free, OSM Nominatim)
  const geocoder = L.Control.geocoder({
    defaultMarkGeocode: false
  })
  .on("markgeocode", (e) => {
    const center = e.geocode.center;
    setDestination(center.lat, center.lng);
    map.setView(center, 15);
  })
  .addTo(map);

  // Tap to set destination
  map.on("click", (e) => {
    setDestination(e.latlng.lat, e.latlng.lng);
  });

  // Try current location for map center
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 15);
        updateUserMarker(latitude, longitude, pos.coords.accuracy);
      },
      () => map.setView([20.5937, 78.9629], 5), // India fallback
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  } else {
    map.setView([20.5937, 78.9629], 5);
  }
}

function setDestination(lat, lng) {
  state.dest = { lat, lng };
  if (!destMarker) {
    destMarker = L.marker([lat, lng], { draggable: false }).addTo(map);
  } else {
    destMarker.setLatLng([lat, lng]);
  }
  drawDestCircle();
}

function drawDestCircle() {
  if (!state.dest) return;
  if (destCircle) destCircle.remove();
  destCircle = L.circle([state.dest.lat, state.dest.lng], {
    radius: state.radius,
    color: "#0ea5e9",
    fillColor: "#0ea5e9",
    fillOpacity: 0.15,
  }).addTo(map);
}

function updateUserMarker(lat, lng, accuracy) {
  if (!userMarker) {
    userMarker = L.marker([lat, lng], { title: "You" }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lng]);
  }

  if (accuracy) {
    if (accuracyCircle) accuracyCircle.setLatLng([lat,lng]).setRadius(accuracy);
    else accuracyCircle = L.circle([lat,lng], { radius: accuracy, color:"#94a3b8", fillOpacity:.1 }).addTo(map);
  }
}

function distanceMeters(a, b) {
  // Use Leaflet's built-in distance if map exists
  if (map) return map.distance(a, b);
  // Haversine fallback
  const toRad = d => d * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat/2)**2 + Math.sin(dLng/2)**2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => console.log("Wake lock released"));
      console.log("Wake lock acquired");
    }
  } catch (e) {
    console.warn("Wake lock failed:", e);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

async function armAlarm() {
  if (!state.dest) {
    alert("Pick a destination first (search or tap on the map).");
    return;
  }
  if (!navigator.geolocation) {
    alert("Geolocation is not supported on this device.");
    return;
  }

  // Prepare audio: use uploaded file or default asset
  const audio = els.alarmAudio;
  if (els.audioFile.files && els.audioFile.files[0]) {
    const fileURL = URL.createObjectURL(els.audioFile.files[0]);
    audio.src = fileURL;
  } else {
    audio.src = "assets/default-alarm.wav";
  }
  audio.loop = true;

  try {
    // A user gesture (clicking "Arm Alarm") allows play()
    await audio.play();
    audio.pause(); // pre-warm to satisfy autoplay policies
  } catch (e) {
    console.warn("Audio pre-warm failed:", e);
  }

  if (els.wakeLockToggle.checked) await requestWakeLock();

  els.gpsStatus.textContent = "Starting…";
  watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 15000,
  });

  armed = true;
  triggered = false;
  els.armBtn.disabled = true;
  els.stopBtn.disabled = false;
}

function stopAlarm() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  const audio = els.alarmAudio;
  try { audio.pause(); audio.currentTime = 0; } catch(e){}
  if (vibrateTimer) clearInterval(vibrateTimer);
  navigator.vibrate(0);
  releaseWakeLock();

  armed = false;
  triggered = false;
  els.armBtn.disabled = false;
  els.stopBtn.disabled = true;
  els.insideText.textContent = "No";
  els.insideText.classList.remove("yes");
}

function onPosition(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  els.gpsStatus.textContent = `OK (±${Math.round(accuracy)} m)`;
  updateUserMarker(latitude, longitude, accuracy);

  if (!state.dest) return;
  const dist = distanceMeters({lat: latitude, lng: longitude}, state.dest);
  els.distanceText.textContent = `${Math.round(dist)} m`;

  const inside = dist <= state.radius;
  if (inside) {
    els.insideText.textContent = "Yes";
    els.insideText.classList.add("yes");
    if (armed && !triggered) {
      triggerAlarm();
    }
  } else {
    els.insideText.textContent = "No";
    els.insideText.classList.remove("yes");
  }
}

function onPositionError(err) {
  console.error(err);
  els.gpsStatus.textContent = err.message || "Location error";
}

function triggerAlarm() {
  triggered = true;
  const audio = els.alarmAudio;
  audio.play().catch(e => console.warn("Alarm play failed:", e));

  // Android supports vibration. iOS Safari generally does not.
  try {
    navigator.vibrate([1000, 500, 1000]);
    if (vibrateTimer) clearInterval(vibrateTimer);
    vibrateTimer = setInterval(() => navigator.vibrate([800, 400, 800]), 4000);
  } catch (e) {
    console.warn("Vibration failed:", e);
  }

  alert("You have arrived in the target area!");
}

els.armBtn.addEventListener("click", armAlarm);
els.stopBtn.addEventListener("click", stopAlarm);

// PWA: install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn.hidden = false;
});
els.installBtn.addEventListener('click', async () => {
  els.installBtn.hidden = true;
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }
});

// Register SW
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(console.warn);
  });
}

initMap();
