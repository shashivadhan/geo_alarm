// Location Alarm App (Leaflet + Geolocation + Vibration + Audio + PWA)

let map, userMarker, userCircle, accuracyCircle, destMarker, destCircle;
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
  // Green glowing circle for user location
  if (!userCircle) {
    userCircle = L.circleMarker([lat, lng], {
      radius: 9,
      color: "#16a34a",      // green border
      fillColor: "#22c55e",  // bright green fill
      fillOpacity: 0.9,
      className: "user-location"
    }).addTo(map);
  } else {
    userCircle.setLatLng([lat, lng]);
  }

  // Accuracy circle (thin outline)
  if (accuracy) {
    if (accuracyCircle) accuracyCircle.setLatLng([lat,lng]).setRadius(accuracy);
    else accuracyCircle = L.circle([lat,lng], { radius: accuracy, color:"#94a3b8", weight:1, fillOpacity:.07 }).addTo(map);
  }
}
