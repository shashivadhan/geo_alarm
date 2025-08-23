let map;
let userMarker;
let destinationMarker;
let radiusCircle;
let watchId;

const els = {
  gpsStatus: document.getElementById("gps-status"),
  distance: document.getElementById("distance"),
  inside: document.getElementById("inside"),
  radius: document.getElementById("radius"),
  armButton: document.getElementById("arm"),
  stopButton: document.getElementById("stop"),
};

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 20.5937, lng: 78.9629 }, // India center as default
    zoom: 5,
    mapTypeControl: false,
    fullscreenControl: false,
  });

  // Allow user to tap map to set destination
  map.addListener("click", (e) => {
    setDestination(e.latLng);
  });

  // Start GPS
  startWatching();
}

function startWatching() {
  if (!navigator.geolocation) {
    els.gpsStatus.textContent = "❌ GPS not supported on this device/browser.";
    return;
  }

  els.gpsStatus.textContent = "⏳ Requesting GPS...";

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      updateUserMarker(latitude, longitude, accuracy);
      els.gpsStatus.textContent = `✅ GPS active (±${Math.round(accuracy)}m)`;
    },
    (err) => {
      console.warn("GPS error:", err);
      if (err.code === 1) {
        els.gpsStatus.textContent =
          "❌ Location permission denied. Enable it in browser settings.";
      } else if (err.code === 2) {
        els.gpsStatus.textContent = "❌ Position unavailable.";
      } else if (err.code === 3) {
        els.gpsStatus.textContent = "❌ GPS timeout, retrying...";
        setTimeout(startWatching, 3000);
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

function updateUserMarker(lat, lng, accuracy) {
  const pos = { lat, lng };

  if (!userMarker) {
    userMarker = new google.maps.Marker({
      position: pos,
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "green",
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: "white",
      },
      title: "Your Location",
    });
    map.setCenter(pos);
    map.setZoom(15);
  } else {
    userMarker.setPosition(pos);
  }

  // If destination exists, update distance
  if (destinationMarker) {
    const dist = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(lat, lng),
      destinationMarker.getPosition()
    );

    els.distance.textContent = `${Math.round(dist)} m`;
    const radius = parseInt(els.radius.value, 10);

    if (dist <= radius) {
      els.inside.textContent = "Yes ✅";
      els.inside.style.color = "lime";
    } else {
      els.inside.textContent = "No ❌";
      els.inside.style.color = "red";
    }
  }
}

function setDestination(latLng) {
  if (destinationMarker) destinationMarker.setMap(null);
  if (radiusCircle) radiusCircle.setMap(null);

  destinationMarker = new google.maps.Marker({
    position: latLng,
    map: map,
    icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
    title: "Destination",
  });

  radiusCircle = new google.maps.Circle({
    strokeColor: "#FF0000",
    strokeOpacity: 0.6,
    strokeWeight: 2,
    fillColor: "#FF0000",
    fillOpacity: 0.2,
    map,
    center: latLng,
    radius: parseInt(els.radius.value, 10),
  });

  map.panTo(latLng);
}

// Arm/Stop alarm handlers
els.armButton.addEventListener("click", () => {
  if (!destinationMarker) {
    alert("Please select a destination on the map.");
    return;
  }
  els.gpsStatus.textContent = "✅ Alarm armed, tracking location...";
});

els.stopButton.addEventListener("click", () => {
  els.gpsStatus.textContent = "⏹️ Alarm stopped.";
});
