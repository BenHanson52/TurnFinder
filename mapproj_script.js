// mapproj_script.js
// initializing the map
const map = L.map('map', {
center: [39.7983, -105.7778],  
zoom:   8                    
});

L.Control.geocoder({
    defaultMarkGeocode: true
  })
    .on('markgeocode', function(e) {
      const bbox = e.geocode.bbox;
      const bounds = L.latLngBounds(bbox);
      map.fitBounds(bounds); 
    })
    .addTo(map);
  

const params     = new URLSearchParams(location.search);
const sharedLat  = params.get('lat');
const sharedLng  = params.get('lng');
//geolocation api logic
if (!("geolocation" in navigator)) {
    alert("Geolocation not supported by your browser.");
    map.setView([39.7983, -105.7778], 10);
} 
else if (sharedLat && sharedLng) {
    map.setView([ +sharedLat, +sharedLng ], 13);
}
else {
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout: 10_000,  
        maximumAge: 0        // no cached positions
    });
}

function onSuccess(position) {
    const { latitude, longitude } = position.coords;

    map.setView([ latitude, longitude ], 13);

    L.circle([ latitude, longitude ], {
        color:       'blue',    
        fillColor:   'blue',    
        fillOpacity: 0.3,       
        radius:      40         // radius in meters
})
.addTo(map)
.bringToFront()          
.myLocation = true;     
}

// geolocation error handling
function onError(err) {
    console.warn(`Geolocation error (${err.code}): ${err.message}`);
    let msg;
    switch (err.code) {
        case err.PERMISSION_DENIED:
        msg = "Location permission was denied. Showing default view.";
        break;
        case err.POSITION_UNAVAILABLE:
        msg = "Position unavailable. Showing default view.";
        break;
        case err.TIMEOUT:
        msg = "Location request timed out. Showing default view.";
        break;
        default:
        msg = "An unknown geolocation error occurred. Showing default view.";
    }
    alert(msg);
    const defaultLatLng = [39.7983, -105.7778]; 
    map.setView(defaultLatLng, 8);
}

const loginModal   = document.getElementById('loginModal');
const loginFields = document.querySelector('.login-fields');
const regFields = document.querySelector('.registration-fields');
const submitBtn = document.getElementById('submitBtn');
const toggleBtn = document.getElementById('toggleBtn');
const formTitle = document.getElementById('formTitle');

function openAuthModal(mode /* "login" | "register" */){
    if(mode === "login"){
        loginFields.classList.remove('hidden');
        regFields  .classList.add   ('hidden');
        formTitle.textContent = "Please Log In";
        submitBtn.textContent = "Login";
        toggleBtn.textContent = "Create Account";
    }else{
        loginFields.classList.add   ('hidden');
        regFields  .classList.remove('hidden');
        formTitle.textContent = "Create Account";
        submitBtn.textContent = "Create Account";
        toggleBtn.textContent = "Cancel";
    }
    loginModal.classList.remove('hidden');
}

// overriding Leaflet’s global popup defaults:
L.Popup.prototype.options.minWidth = 450;
L.Popup.prototype.options.maxWidth = 600;

// logic for sharing a pin
document.addEventListener('click', async e => {
    if (e.target.matches('.share-pin')) {
    const lat = e.target.dataset.lat;
    const lng = e.target.dataset.lng;
    const shareUrl = `${location.origin}${location.pathname}?lat=${lat}&lng=${lng}`;

    try {
        await navigator.share({
        title: "SummertimeSkiingCO Pin",
        text: "Check out these conditions:",
        url: shareUrl
        });
        console.log("Shared successfully");
    } catch (err) {
        console.warn("Share failed:", err);
    }
    }
});

// shows admin panel button if user role is admin.
const currentRole = localStorage.getItem('role');
if (currentRole === 'admin') {
    document.getElementById('adminPanelBtn').classList.remove('hidden');
}

// admin Panel pop-up data grab from backend
document.getElementById('adminPanelBtn').addEventListener('click', async function() {
    const authCredentials = localStorage.getItem('authCredentials');
    if (!authCredentials) {
        alert("You are not logged in as admin!");
        return;
    }
    try {
        const response = await fetch('/api/admin/users', {
            headers: {
            'Authorization': 'Basic ' + authCredentials
            }
    });
    if (response.ok) {
        //await keyword waits parsing to finish
        const users = await response.json();
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = "";
        users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${user.id}</td><td>${user.username}</td><td>${user.role}</td>`;
        tbody.appendChild(row);
        });
        
        document.getElementById('adminPanelModal').classList.remove('hidden');
    } else {
        alert("Error loading users: " + response.status);
    }
    } catch (err) {
    console.error("Error:", err);
    alert("An error occurred.");
    }
});


document.getElementById('closeAdminPanel').addEventListener('click', function() {
    document.getElementById('adminPanelModal').classList.add('hidden');
});


const pinsGroup = L.layerGroup().addTo(map);

function getCurrentUsername() {
    const authCredentials = localStorage.getItem('authCredentials');
    if (!authCredentials) return "";
    return atob(authCredentials).split(':')[0];
}

function getCurrentUserRole() {
    return localStorage.getItem('role') || "";
}

// Function to load pins dynamically via AJAX.
async function loadPins() {
    try {
    const response = await fetch('/api/endpoint');
    const data = await response.json();
    // Clear existing markers in pinsGroup.
    pinsGroup.clearLayers();
    // Retrieve current username and role from stored credentials.
    const currentUsername = getCurrentUsername();
    const currentRole = getCurrentUserRole();
    data.forEach(pin => {
        const latNum = parseFloat(pin.lat);
        const lngNum = parseFloat(pin.lng);

        // building popup content
        let popupContent = `<strong>${pin.name}</strong><br>${pin.description}<br>`;
        /* IMAGE SECTION  */
        if (pin.imageUrls && pin.imageUrls.length) {
            const carId = `car-${pin.id}`;
            popupContent += `
            <div class="carousel" id="${carId}">
                <button class="car-prev">◀</button>
                <div class="car-images">
                ${pin.imageUrls
                    .map((u, i) =>
                    `<img data-idx="${i}" src="${u}?t=${Date.now()}"
                            class="car-img${i === 0 ? '' : ' hidden'}">`)
                    .join('')}
                </div>
                <button class="car-next">▶</button>
            </div>
            `;
        } else if (pin.imageUrl) {
            // legacy, single image
            popupContent += `<img src="${pin.imageUrl}?t=${Date.now()}" style="max-width:100%;height:auto;"><br>`;
        }
        if (pin.username) {
        const formatted = new Date(pin.created_at)
            .toLocaleString('en-US',{ dateStyle:'short', timeStyle:'short' });
        popupContent += `<p>User: ${pin.username}</p><p>Last Edited: ${formatted}</p>`;
        }
        if (canShare) {
        popupContent += `<button class="share-pin" data-lat="${latNum}" data-lng="${lngNum}">Share</button><br>`;
        }
        if ((pin.username === currentUsername) || currentRole === 'admin') {
        popupContent += `
            <button class="edit-pin"   data-id="${pin.id}">Edit</button>
            <button class="delete-pin" data-id="${pin.id}">Delete</button>`;
        }

        // creating/binding marker with content
        const marker = L.marker([latNum, lngNum])
        .bindPopup(popupContent, {
            className:   "pin-view-popup",
            minWidth:    300,
            maxWidth:    400,
            maxHeight:   400,
            autoPan:     true,
            keepInView:  true,
            autoPanPadding: [30, 30]
        });

        // adds marker to the map
        pinsGroup.addLayer(marker);

        // if lat/lng are shared then the popup will open automatically.
        if (
        !isNaN(sharedLat) &&
        !isNaN(sharedLng) &&
        Math.abs(sharedLat - latNum) < 1e-6 &&
        Math.abs(sharedLng - lngNum) < 1e-6
        ) {
        map.setView([latNum, lngNum], 10);
        marker.openPopup();
        }
    });
    } catch (error) {
    console.error('Error fetching pins:', error);
    }
}

function onSuccessfulLogin(username){
    hideLoginModal();
    greeting.textContent = `Logged in as: ${username}!`;
    greeting.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    loginBtn .classList.add('hidden');
    createBtn.classList.add('hidden');
}

function hideLoginModal(){ loginModal.classList.add('hidden'); }

function updatePins(pin) {
    console.log('WS → new pin', pin);

    // build popup exactly like loadPins() does
    const latNum = parseFloat(pin.lat);
    const lngNum = parseFloat(pin.lng);

    let popupContent = `<strong>${pin.name}</strong><br>${pin.description}<br>`;

    if (pin.imageUrls && pin.imageUrls.length) {
        const carId = `car-${pin.id}`;
        popupContent += `
        <div class="carousel" id="${carId}">
          <button class="car-prev">◀</button>
          <div class="car-images">
            ${pin.imageUrls.map((u, i) => `
                <img data-idx="${i}" src="${u}?t=${Date.now()}"
                     class="car-img${i === 0 ? '' : ' hidden'}">`).join('')}
          </div>
          <button class="car-next">▶</button>
        </div>`;
    }

    const formatted = new Date(pin.created_at)
      .toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    popupContent += `<p>User: ${pin.username}</p><p>Last Edited: ${formatted}</p>`;

    if (canShare) {
        popupContent += `<button class="share-pin" data-lat="${latNum}"
                          data-lng="${lngNum}">Share</button><br>`;
    }

    const marker = L.marker([latNum, lngNum])
        .bindPopup(popupContent, {
            className: "pin-view-popup",
            minWidth: 300, maxWidth: 400, maxHeight: 400,
            autoPan: true, keepInView: true, autoPanPadding: [30, 30]
        });

    pinsGroup.addLayer(marker);
}

// buttons are now in the DOM
const loginBtn  = document.getElementById('loginBtn');
const createBtn = document.getElementById('createBtn');
const logoutBtn = document.getElementById('logoutBtn');
const greeting  = document.getElementById('userGreeting');

document.addEventListener('DOMContentLoaded', () => {
    // connecting to my wS
    const protocol = (location.protocol === 'https:') ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}/api/`);

    // this is what sets up the WS to listen for pins
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received WebSocket message:', data);
        updatePins(data);
    };
    // Handle the connection open event
    ws.onopen = () => {
        console.log('WebSocket connection established.');
    };

    // Handle errors
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    // Handle connection closure
    ws.onclose = () => {
        console.log('WebSocket connection closed.');
    };    

    function handleLogout(){
        localStorage.clear();
        loginBtn.classList.remove('hidden');
        createBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        greeting.classList.add('hidden');
        greeting.textContent = "You've been logged out";
    }

    loginBtn .addEventListener('click', () => openAuthModal('login'));
    createBtn.addEventListener('click', () => openAuthModal('register'));
    logoutBtn.addEventListener('click', handleLogout);

    loadPins();
});


// Attach event listener to the login form.
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    // Check if we are in registration mode by testing if registration fields are visible.
    const regFieldsVisible = !document.querySelector('.registration-fields').classList.contains('hidden');
    if (regFieldsVisible) {
    // Create Account mode
    const new_username = document.getElementById('new_username').value;
    const new_password = document.getElementById('new_password').value;
    if (!new_username || !new_password) {
        alert("Please fill in both new username and new password.");
        return;
    }
    try {
        const response = await fetch('/api/createAccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_username, new_password })
        });
        
        if (response.status === 409) {
        // The backend returned "Username already taken" due to ER_DUP_ENTRY
        alert("Username already taken. Please choose a different username.");
        } else if (response.ok) {
        // Only do automatic login if we got a 201 response (response.ok)
        // Attempt automatic login here:
        const loginResponse = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: new_username, password: new_password })
        });

        if (loginResponse.ok) {
            const data = await loginResponse.json();
            // Set login state, credentials, and role.
            localStorage.setItem('loggedIn', 'true');
            localStorage.setItem('authCredentials', btoa(new_username + ':' + new_password));
            localStorage.setItem('role', data.role);
            onSuccessfulLogin(new_username);
            // Reload pins to include user-specific buttons.
            loadPins();
            // Show the admin panel button if role is admin.
            if (data.role === 'admin') {
                document.getElementById('adminPanelBtn').classList.remove('hidden');
            }
        } else {
            alert("Account created, but automatic login failed. Please log in manually.");
        }
        } else {
        // If it's not 409 or 2xx, show a generic error
        alert("Account creation failed. Please try again.");
        }
    } catch (error) {
        console.error('Error during account creation:', error);
        alert("An error occurred. Please try again.");
    }
    } else {
    // Login mode
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        // Send the credentials to a new login endpoint.
        const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            // If login is successful, set a flag and store credentials and role.
            localStorage.setItem('loggedIn', 'true');
            localStorage.setItem('authCredentials', btoa(username + ':' + password));
            localStorage.setItem('role', data.role);
            onSuccessfulLogin(username);  
            // Reload pins to include user-specific buttons.
            loadPins();
            // Show the admin panel button if user is admin.
            if (data.role === 'admin') {
                document.getElementById('adminPanelBtn').classList.remove('hidden');
            }
        } else {
            alert('Login failed, please try again.');
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('An error occurred. Please try again.');
    }
    }
});

// Toggle between Login and Create Account mode.
document.getElementById('toggleBtn').addEventListener('click', function() {   

    const loginUsername = document.getElementById('username');
    const loginPassword = document.getElementById('password');
    const newUsername = document.getElementById('new_username');
    const newPassword = document.getElementById('new_password');

    // Check if registration fields are currently hidden.
    const isRegistration = !regFields.classList.contains('hidden');
    
    if (!isRegistration) {
    // Switch TO create account mode.
    loginFields.classList.add('hidden');
    regFields.classList.remove('hidden');

    // Remove required from login fields.
    loginUsername.removeAttribute('required');
    loginPassword.removeAttribute('required');

    // Add required to registration fields.
    newUsername.setAttribute('required', 'true');
    newPassword.setAttribute('required', 'true');

    formTitle.textContent = "Create Account";
    submitBtn.textContent = "Create Account";
    toggleBtn.textContent = "Cancel";
    } else {
    // Switch BACK to login mode.
    loginFields.classList.remove('hidden');
    regFields.classList.add('hidden');

    // Add required back to login fields.
    loginUsername.setAttribute('required', 'true');
    loginPassword.setAttribute('required', 'true');

    // Remove required from registration fields.
    newUsername.removeAttribute('required');
    newPassword.removeAttribute('required');

    formTitle.textContent = "Please Log In";
    submitBtn.textContent = "Login";
    toggleBtn.textContent = "Create Account";
    }
});

// Global event delegation for Edit and Delete buttons in popups.
document.addEventListener('click', async (e) => {
    // Edit pin
    if (e.target && e.target.classList.contains('edit-pin')) {
        const pinId = e.target.getAttribute('data-id');
        const currentName = decodeURIComponent(e.target.getAttribute('data-name'));
        const currentDescription = decodeURIComponent(e.target.getAttribute('data-description'));
        const newName = prompt("Enter new pin name:", currentName);
        const newDescription = prompt("Enter new description:", currentDescription);
        if (newName !== null && newDescription !== null) {
            try {
            const auth = localStorage.getItem('authCredentials');
            const response = await fetch('/api/endpoint', {
                method: 'PUT',
                headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + auth
                },
                body: JSON.stringify({
                id: pinId,
                name: newName,
                description: newDescription
                })
            });
            if (response.ok) {
                alert("Pin updated successfully.");
                // Dynamically reload pins without a full page refresh.
                loadPins();
            } else {
                alert("Failed to update pin.");
            }
            } catch (err) {
            console.error("Error updating pin:", err);
            alert("Error updating pin.");
            }
        }
    }
    // Delete pin
    if (e.target && e.target.classList.contains('delete-pin')) {
        const pinId = e.target.getAttribute('data-id');
    if (confirm("Are you sure you want to delete this pin?")) {
        try {
        const auth = localStorage.getItem('authCredentials');
        const response = await fetch('/api/endpoint', {
            method: 'DELETE',
            headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + auth
            },
            body: JSON.stringify({ id: pinId })
        });
        if (response.ok) {
            alert("Pin deleted successfully.");
            // Dynamically reload pins without a full page refresh.
            loadPins();
        } else {
            alert("Failed to delete pin.");
        }
        } catch (err) {
            console.error("Error deleting pin:", err);
            alert("Error deleting pin.");
        }
    }
    }
});

        // global delegation for carousel buttons
document.addEventListener('click', e => {
    if (!e.target.matches('.car-prev, .car-next')) return;
  
    const carousel   = e.target.closest('.carousel');
    const images     = carousel.querySelectorAll('.car-img');
    const visibleIdx = [...images].findIndex(img => !img.classList.contains('hidden'));
  
    let newIdx = visibleIdx + (e.target.matches('.car-next') ? 1 : -1);
    if (newIdx < 0)              newIdx = images.length - 1;   // wrap backward
    if (newIdx >= images.length) newIdx = 0;                   // wrap forward
  
    images[visibleIdx].classList.add('hidden');
    images[newIdx]   .classList.remove('hidden');
});
  

// prepping to check if a popup form is already open so that they'll
// close when the user clicks outside of the form.
let currentPinMarker = null;
// functionality for adding a pin (moved the map definition above so we can use it here)
map.on('click', function(e) {
    const isLoggedIn = localStorage.getItem('loggedIn');
    console.log("Map clicked at:", e.latlng);
    if (
        currentPinMarker &&
        currentPinMarker.getPopup() &&
        currentPinMarker.getPopup().isOpen()
      ) {
        currentPinMarker.closePopup();
        return;
      }
    // creates a new marker at the clicked location but that marker won't stay
    // unless the user submits it with the required info attached
    const newMarker = L.marker(e.latlng);
    currentPinMarker = newMarker;
    pinsGroup.addLayer(newMarker);
    newMarker.submitted = false;

    // removes the marker if the popup is closed without submission.
    newMarker.on('popupclose', () => {
    if (!newMarker.submitted) {
        pinsGroup.removeLayer(newMarker);
    }
    currentPinMarker = null;
    });

    // cloning the template for the form so it can be reused fresh
    // for each pin
    const template = document.getElementById('pinFormTemplate');
    const formClone = document.importNode(template.content, true);
    // grabbing the form from the cloned template
    const userPin = formClone.querySelector('#pinForm');

    // having leaflet set the lat/lng values itself
    userPin.querySelector('#lat').value = e.latlng.lat;
    userPin.querySelector('#lng').value = e.latlng.lng;

    // attaching an async event listener to the form so that
    // it'll update without the user having to refresh the page
    userPin.addEventListener('submit', async function(ev) {
    ev.preventDefault(); // Prevent native submission.
    console.log("Form submit event fired!");

    if (!isLoggedIn) {
    alert("Login is required to place a pin."); //changed this block so possible hiring managers can look at the site.
    return;
    }

    // this grabs the image file's 'name'
    const fileInput = userPin.querySelector('input[name="image"]');

    // creating formdata from the userpin form so that
    // my backend can process it
    const formData = new FormData(userPin);
    console.log("Sending POST request with formData...");
    
    // if a user does choose to upload an image, this compresses it,
    // saving a ton of headache of sending huge files to my server, and 
    // then having to compress that on my backend
    if (fileInput && fileInput.files.length) {
        const maxPhotos = 5;
        if (fileInput.files.length > maxPhotos) {
            alert(`You selected ${fileInput.files.length} photos — only ${maxPhotos} can be uploaded.`);
            return;                       // stop the submit
        }
    
        const files = Array.from(fileInput.files);   // ≤ 5
        const compressedFiles = [];
    
        const options = {
            maxSizeMB: 1,           // tweak to taste
            maxWidthOrHeight: 800,
            useWebWorker: true
        };
    
        try {
            for (const f of files) {
                const blob = await imageCompression(f, options);
                compressedFiles.push(
                    new File([blob], f.name, { type: blob.type })
                );
            }
        } catch (err) {
            console.error('compression failed', err);
            alert('Could not compress photos – try again.');
            return;
        }

        // ***Do NOT touch fileInput.files on iOS – instead append directly***
        compressedFiles.forEach(f => formData.append('images[]', f));
    }     

    // Add the Authorization header for pin creation using stored credentials.
    const authCredentials = localStorage.getItem('authCredentials');
    let headers = {};
    if (localStorage.getItem('authCredentials')) {
        headers['Authorization'] = 'Basic ' + localStorage.getItem('authCredentials');
    }
    
    //wrapped in a try block as this was a major source of bugs
    // and i wanted debugging statements when this failed
    try {
        const response = await fetch('/api/endpoint', {
        method: 'POST',
        headers,
        body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            alert(err.error || 'You’ve hit your pin limit for today.');
            return;
        }

        const data = await response.json();
        console.log("Received data:", data);
        
        
        //checking that the data is associated with an id
        //if it is, we render the pop up with the image included
        // ?t=${Date.now()} is a 'cache-busting' technique that ensures
        // new images are displayed immediately.
        if (data.id) {
            updatePins(data);
            newMarker.submitted = true;
            newMarker.closePopup();
        } else {
        pinsGroup.removeLayer(newMarker);
        alert("Submission failed. Please try again.");
        }
    } catch (fetchError) {
        console.error("Error during fetch:", fetchError);
        pinsGroup.removeLayer(newMarker);
        alert("Submission failed. Please try again.");
    }
    });
    
    // making sure the submit button actually submits..
    const saveBtn = userPin.querySelector('#submitbtn');
    if (saveBtn) {
    saveBtn.addEventListener('click', function() {
        if (isLoggedIn) {
        console.log("Submit button clicked!");
        userPin.dispatchEvent(new Event("submit", { cancelable: true }));
        }
        if (!isLoggedIn) {
            alert("Please create an account or login to place a pin");
            loginModal.classList.remove('hidden');
        }
    });
    } else {
    console.error("Submit button not found in the cloned form.");
    }
    
    //this attaches the popup to the cloned form (the userpin form the user fills out)
    newMarker.bindPopup(formClone, {
    minWidth: 300,          // at least 300px wide
    maxWidth: 400,          // but no more than 400px
    maxHeight: 350,         // cap height (will scroll if content overflows)
    autoPan: true,          // pan map when popup opens
    keepInView: true,       // ensure the whole popup stays in view
    autoPanPadding: [30,30] // leave a 30px buffer from each map edge
    })
    .openPopup();
});
// following blocks are my basemap layers, tileLayer is a leaflet module that
// ensures they're base layers rather than overlays
const USGS_USTopo = L.tileLayer(
    'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    {
        attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
    }
);
const USGS_USImageryTopo = L.tileLayer(
    'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}',
    {
        attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
    }
);
const USGS_sat = L.tileLayer(
    'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
    {
        attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
    }
);
const county_layer = L.esri.featureLayer({
    url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Census_Counties/FeatureServer/0', 
    style: {
    color: '#a3121c',    // boundary color
    weight: 1.5,      // line thickness
    fillOpacity: 0    // no fill
    }
});

const avy_paths = L.esri.featureLayer({
    url: 'https://services1.arcgis.com/0MSEUqKaxRlEPj5g/arcgis/rest/services/Backcountry_AVPaths/FeatureServer/2', 
    style: {
    color: '#97f0ee',    // boundary color
    weight: 1,      // line thickness
    fillOpacity: 0.4    // needs fill
    }
});

const ski_areas = L.esri.featureLayer({
    url: 'https://services1.arcgis.com/0MSEUqKaxRlEPj5g/arcgis/rest/services/CO_Ski_Area_Boundaries/FeatureServer/2', 
    style: {
    color: '#d6cd51',    // boundary color
    weight: 1,      // line thickness
    fillOpacity: 0.4    // needs fill
    }
});
//initializing my map with the combined satellite imagery and topography
map.addLayer(USGS_USImageryTopo);

const federalLandURLs = [
    'https://gis.colorado.gov/public/rest/services/OIT/Colorado_State_Basemap/MapServer/68',
    'https://gis.colorado.gov/public/rest/services/OIT/Colorado_State_Basemap/MapServer/46',
    'https://gis.colorado.gov/public/rest/services/OIT/Colorado_State_Basemap/MapServer/63',
    'https://gis.colorado.gov/public/rest/services/OIT/Colorado_State_Basemap/MapServer/62',
    'https://gis.colorado.gov/public/rest/services/OIT/Colorado_State_Basemap/MapServer/57',
    'https://gis.colorado.gov/public/rest/services/OIT/Colorado_State_Basemap/MapServer/61',
    'https://gis.colorado.gov/public/rest/services/OIT/Colorado_State_Basemap/MapServer/50'
];

//the block below combines all of the overlays from the block above so the user won't
//have to have separate national forest, national grassland, BLM land, etc overlays
const fedLandLayer = L.featureGroup();
federalLandURLs.forEach(url => {
    L.esri.featureLayer({
    url: url,
    style: function () {
        return { color: "yellow", weight: 1, fillOpacity: 0.1 };
    }
    }).addTo(fedLandLayer);
});

//This adds the trailhead overlay, I need to make these pop ups smaller as I 
//want the focus to be on user-created pins
const trailheads = L.esri.featureLayer({
    url: 'https://gis.colorado.gov/public/rest/services/OIT/Colorado_State_Basemap/MapServer/29',
    pointToLayer: function (geojson, latlng) {
    return L.circleMarker(latlng, {
    radius: 4,           // size of the marker
    fillColor: "green",  // fill color of the marker
    color: "darkgreen",  // border color
    weight: 1,           // border thickness
    opacity: 1,          // overall opacity of the border
    fillOpacity: 0.8     // opacity of the fill
    });
    }

});
//the menu for my base layers
const baseLayers = {
    "Topographic": USGS_USTopo,
    "Topo & Satellite": USGS_USImageryTopo,
    "Satellite": USGS_sat
};
//menu for my overlays
const overlayLayers = {
    "Federal Land": fedLandLayer,
    "COTREX Trailheads": trailheads,
    "Counties": county_layer,
    "Known Avy Paths": avy_paths,
    "Ski Area Boundaries": ski_areas
};
//the actual control panel that handles base layers and overlays.
L.control.layers(baseLayers, overlayLayers).addTo(map);

// web sharing api logic
const canShare = !!navigator.share;