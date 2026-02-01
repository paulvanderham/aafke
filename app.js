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
    let deviceHeading = 0;
    let targetRotation = 0;
    let currentRotation = 0;
    let hasFound = false;
    let animationFrame = null;

    // ==================== SCHERM FUNCTIES ====================

    function showScreen(name) {
        console.log('Toon scherm:', name);
        Object.values(screens).forEach(s => s.classList.remove('active'));
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

        // Simuleer positie dichtbij het graf
        currentPosition = {
            latitude: CONFIG.grave.latitude + 0.00002,
            longitude: CONFIG.grave.longitude + 0.00002
        };

        // Toon gevonden scherm na 2 seconden
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

        // Vibreer
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }

        // Stop GPS
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }

        showScreen('found');
    }

    // ==================== GPS FUNCTIES ====================

    function startGPS() {
        console.log('Start GPS');

        if (!navigator.geolocation) {
            showError('Je browser ondersteunt geen GPS');
            return;
        }

        updateStatus('GPS wordt gezocht...');
        startButton.style.display = 'none';

        // Start GPS watching
        watchId = navigator.geolocation.watchPosition(
            onPositionSuccess,
            onPositionError,
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 5000
            }
        );

        // Start ook orientation
        startCompass();
    }

    function onPositionSuccess(position) {
        console.log('GPS positie:', position.coords.latitude, position.coords.longitude);

        currentPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };

        // Bereken afstand
        const distance = calculateDistance(
            currentPosition.latitude,
            currentPosition.longitude,
            CONFIG.grave.latitude,
            CONFIG.grave.longitude
        );

        console.log('Afstand:', distance, 'meter');

        updateDistance(distance);
        updateAccuracy(position.coords.accuracy);

        // Update pijl
        updateArrow();

        // Check of we er zijn
        if (distance <= CONFIG.foundDistance) {
            triggerFound();
        } else if (distance <= CONFIG.nearDistance) {
            updateStatus('Je bent heel dichtbij...');
        } else {
            updateStatus('Volg de pijl naar de rustplaats');
        }
    }

    function onPositionError(error) {
        console.log('GPS error:', error.code, error.message);

        let msg = 'GPS fout. ';
        if (error.code === 1) {
            msg = 'Geef toestemming voor locatie in je browser instellingen.';
        } else if (error.code === 2) {
            msg = 'Locatie niet beschikbaar. Ga naar buiten.';
        } else if (error.code === 3) {
            msg = 'GPS time-out. Probeer opnieuw.';
        }

        showError(msg);
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
                .catch(console.log);
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
        let heading = 0;

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
                // Bereken richting naar graf
                const bearing = calculateBearing(
                    currentPosition.latitude,
                    currentPosition.longitude,
                    CONFIG.grave.latitude,
                    CONFIG.grave.longitude
                );

                // Relatieve richting (compenseer voor device heading)
                targetRotation = bearing - deviceHeading;

                // Normaliseer naar -180 tot 180
                while (targetRotation > 180) targetRotation -= 360;
                while (targetRotation < -180) targetRotation += 360;

                // Smooth interpolatie
                let diff = targetRotation - currentRotation;
                while (diff > 180) diff -= 360;
                while (diff < -180) diff += 360;
                currentRotation += diff * 0.1;

                // Update pijl
                compassArrow.style.transform = 'translate(-50%, -100%) rotate(' + currentRotation + 'deg)';
            }

            animationFrame = requestAnimationFrame(animate);
        }

        animate();
    }

    function updateArrow() {
        if (!currentPosition) return;

        const bearing = calculateBearing(
            currentPosition.latitude,
            currentPosition.longitude,
            CONFIG.grave.latitude,
            CONFIG.grave.longitude
        );

        targetRotation = bearing - deviceHeading;
    }

    // ==================== BEREKENINGEN ====================

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // meters
        const rad = Math.PI / 180;
        const dLat = (lat2 - lat1) * rad;
        const dLon = (lon2 - lon1) * rad;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);

        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function calculateBearing(lat1, lon1, lat2, lon2) {
        const rad = Math.PI / 180;
        const dLon = (lon2 - lon1) * rad;

        const y = Math.sin(dLon) * Math.cos(lat2 * rad);
        const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
                  Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(dLon);

        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }

    // ==================== EVENT LISTENERS ====================

    // Start knop
    if (startButton) {
        startButton.addEventListener('click', function() {
            console.log('Start knop geklikt');
            startGPS();
        });
    }

    // Test knop
    if (testButton) {
        testButton.addEventListener('click', function() {
            console.log('Test knop geklikt');
            activateTestMode();
        });
    }

    // Retry knop
    if (retryButton) {
        retryButton.addEventListener('click', function() {
            console.log('Retry knop geklikt');
            hasFound = false;
            showScreen('navigation');
            startButton.style.display = 'block';
            updateStatus('Tik op de knop om te starten');
        });
    }

    // Terug knop
    if (backButton) {
        backButton.addEventListener('click', function() {
            console.log('Terug knop geklikt');
            hasFound = false;
            showScreen('navigation');
            startButton.style.display = 'block';
            updateStatus('Tik op de knop om te starten');
        });
    }

    // ==================== INIT ====================

    updateStatus('Tik op de knop om te starten');
    console.log('App klaar');
});
