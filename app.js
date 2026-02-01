/**
 * GPS Grave Finder - Hoofdapplicatie
 */

// Wacht tot DOM geladen is
document.addEventListener('DOMContentLoaded', function() {
    console.log('App gestart');

    // Elementen
    const startButton = document.getElementById('start-gps-button');
    const testButton = document.getElementById('test-mode-button');
    const retryButton = document.getElementById('retry-button');
    const backButton = document.getElementById('back-button');
    const compassArrow = document.getElementById('compass-arrow');
    const distanceNumber = document.getElementById('distance-number');
    const statusMessage = document.getElementById('status-message');
    const accuracyValue = document.getElementById('accuracy-value');
    const errorMessage = document.getElementById('error-message');

    const screens = {
        navigation: document.getElementById('navigation-screen'),
        found: document.getElementById('found-screen'),
        error: document.getElementById('error-screen')
    };

    // State
    let currentPosition = null;
    let watchId = null;
    let pollInterval = null;
    let deviceHeading = 0;
    let targetRotation = 0;
    let currentRotation = 0;
    let hasFound = false;
    let animationFrame = null;
    let gpsActive = false;

    // ==================== SCHERM FUNCTIES ====================

    function showScreen(name) {
        console.log('Toon scherm:', name);
        Object.values(screens).forEach(function(s) {
            s.classList.remove('active');
        });
        if (screens[name]) {
            screens[name].classList.add('active');
        }
    }

    function updateStatus(text) {
        statusMessage.innerHTML = '<p>' + text + '</p>';
    }

    function updateDistance(meters) {
        distanceNumber.textContent = meters < 10 ? meters.toFixed(1) : Math.round(meters);
    }

    function updateAccuracy(meters) {
        accuracyValue.textContent = '±' + Math.round(meters) + 'm';
    }

    // ==================== TEST MODUS ====================

    function activateTestMode() {
        console.log('Test modus geactiveerd');
        updateStatus('🧪 TESTMODUS: Simuleer aankomst...');
        updateDistance(3.2);
        updateAccuracy(5);

        currentPosition = {
            latitude: CONFIG.grave.latitude + 0.00002,
            longitude: CONFIG.grave.longitude + 0.00002
        };

        setTimeout(function() {
            console.log('Test: toon gevonden scherm');
            triggerFound();
        }, 2000);
    }

    // ==================== GEVONDEN ====================

    function triggerFound() {
        if (hasFound) return;
        hasFound = true;

        console.log('Graf gevonden!');

        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }

        stopGPS();
        showScreen('found');
    }

    // ==================== GPS FUNCTIES ====================

    function startGPS() {
        console.log('Start GPS');

        if (!navigator.geolocation) {
            showError('Je browser ondersteunt geen GPS');
            return;
        }

        gpsActive = true;
        updateStatus('GPS wordt gezocht...');
        startButton.style.display = 'none';

        // Methode 1: watchPosition voor continue updates
        watchId = navigator.geolocation.watchPosition(
            onPositionSuccess,
            onPositionError,
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 0  // Altijd verse positie
            }
        );

        // Methode 2: Poll elke 2 seconden als backup
        pollInterval = setInterval(function() {
            if (gpsActive) {
                console.log('GPS poll...');
                navigator.geolocation.getCurrentPosition(
                    onPositionSuccess,
                    function(err) { console.log('Poll error:', err.code); },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            }
        }, 2000);

        // Start kompas
        startCompass();
    }

    function stopGPS() {
        gpsActive = false;

        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }

        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    function onPositionSuccess(position) {
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        var acc = position.coords.accuracy;

        console.log('GPS:', lat.toFixed(6), lon.toFixed(6), 'acc:', Math.round(acc) + 'm');

        currentPosition = {
            latitude: lat,
            longitude: lon
        };

        // Bereken afstand
        var distance = calculateDistance(
            lat, lon,
            CONFIG.grave.latitude,
            CONFIG.grave.longitude
        );

        console.log('Afstand:', Math.round(distance) + 'm');

        updateDistance(distance);
        updateAccuracy(acc);

        // Check of we er zijn
        if (distance <= CONFIG.foundDistance && !hasFound) {
            triggerFound();
        } else if (distance <= CONFIG.nearDistance) {
            updateStatus('Je bent heel dichtbij... ' + Math.round(distance) + 'm');
        } else {
            updateStatus('Afstand: ' + Math.round(distance) + ' meter');
        }
    }

    function onPositionError(error) {
        console.log('GPS error:', error.code, error.message);

        // Niet meteen opgeven - wacht op poll resultaat
        if (!currentPosition) {
            var msg = 'GPS fout. ';
            if (error.code === 1) {
                msg = 'Geef toestemming voor locatie.';
                stopGPS();
                showError(msg);
            } else if (error.code === 2) {
                updateStatus('Wachten op GPS signaal...');
            } else if (error.code === 3) {
                updateStatus('GPS zoeken...');
            }
        }
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        showScreen('error');
    }

    // ==================== KOMPAS ====================

    function startCompass() {
        console.log('Start kompas');

        // iOS vraagt permissie
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(function(response) {
                    if (response === 'granted') {
                        addOrientationListener();
                    }
                })
                .catch(function(err) { console.log('Orientation error:', err); });
        } else {
            addOrientationListener();
        }

        // Start animatie loop
        startArrowAnimation();
    }

    function addOrientationListener() {
        window.addEventListener('deviceorientationabsolute', onOrientation, true);
        window.addEventListener('deviceorientation', onOrientation, true);
    }

    function onOrientation(event) {
        var heading = 0;

        // iOS
        if (event.webkitCompassHeading !== undefined) {
            heading = event.webkitCompassHeading;
        }
        // Android
        else if (event.alpha !== null) {
            heading = 360 - event.alpha;
        }

        deviceHeading = heading;
    }

    function startArrowAnimation() {
        function animate() {
            if (currentPosition) {
                var bearing = calculateBearing(
                    currentPosition.latitude,
                    currentPosition.longitude,
                    CONFIG.grave.latitude,
                    CONFIG.grave.longitude
                );

                targetRotation = bearing - deviceHeading;

                // Normaliseer naar -180 tot 180
                while (targetRotation > 180) targetRotation -= 360;
                while (targetRotation < -180) targetRotation += 360;

                // Smooth interpolatie
                var diff = targetRotation - currentRotation;
                while (diff > 180) diff -= 360;
                while (diff < -180) diff += 360;
                currentRotation += diff * 0.1;

                compassArrow.style.transform = 'translate(-50%, -100%) rotate(' + currentRotation + 'deg)';
            }

            animationFrame = requestAnimationFrame(animate);
        }

        animate();
    }

    // ==================== BEREKENINGEN ====================

    function calculateDistance(lat1, lon1, lat2, lon2) {
        var R = 6371000;
        var rad = Math.PI / 180;
        var dLat = (lat2 - lat1) * rad;
        var dLon = (lon2 - lon1) * rad;

        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);

        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function calculateBearing(lat1, lon1, lat2, lon2) {
        var rad = Math.PI / 180;
        var dLon = (lon2 - lon1) * rad;

        var y = Math.sin(dLon) * Math.cos(lat2 * rad);
        var x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
                Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(dLon);

        var bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }

    // ==================== EVENT LISTENERS ====================

    if (startButton) {
        startButton.addEventListener('click', function() {
            console.log('Start knop geklikt');
            startGPS();
        });
    }

    if (testButton) {
        testButton.addEventListener('click', function() {
            console.log('Test knop geklikt');
            activateTestMode();
        });
    }

    if (retryButton) {
        retryButton.addEventListener('click', function() {
            console.log('Retry knop geklikt');
            hasFound = false;
            showScreen('navigation');
            startButton.style.display = 'block';
            updateStatus('Tik op de knop om te starten');
        });
    }

    if (backButton) {
        backButton.addEventListener('click', function() {
            console.log('Terug knop geklikt');
            hasFound = false;
            stopGPS();
            showScreen('navigation');
            startButton.style.display = 'block';
            updateStatus('Tik op de knop om te starten');
        });
    }

    // ==================== INIT ====================

    updateStatus('Tik op de knop om te starten');
    console.log('App klaar');
});
