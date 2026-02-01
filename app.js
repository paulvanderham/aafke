/**
 * GPS Grave Finder - Hoofdapplicatie
 * Navigeert de gebruiker naar de rustplaats en toont herinneringen
 */

class GraveFinderApp {
    constructor() {
        this.watchId = null;
        this.currentPosition = null;
        this.hasFound = false;
        this.deviceHeading = 0;
        this.gpsStarted = false;
        this.gpsAttempts = 0;
        this.lastRotation = 0;
        this.testMode = false;

        // DOM elementen
        this.screens = {
            navigation: document.getElementById('navigation-screen'),
            found: document.getElementById('found-screen'),
            error: document.getElementById('error-screen')
        };

        this.elements = {
            compassArrow: document.getElementById('compass-arrow'),
            distanceNumber: document.getElementById('distance-number'),
            statusMessage: document.getElementById('status-message'),
            accuracyValue: document.getElementById('accuracy-value'),
            accuracyInfo: document.getElementById('accuracy-info'),
            errorMessage: document.getElementById('error-message'),
            retryButton: document.getElementById('retry-button'),
            backButton: document.getElementById('back-button'),
            startButton: document.getElementById('start-gps-button'),
            testButton: document.getElementById('test-mode-button')
        };

        this.init();
    }

    init() {
        // Event listeners
        this.elements.retryButton.addEventListener('click', () => {
            this.gpsAttempts = 0;
            this.startTracking();
        });
        this.elements.backButton.addEventListener('click', () => {
            this.testMode = false;
            this.showScreen('navigation');
        });

        // Start knop
        if (this.elements.startButton) {
            this.elements.startButton.addEventListener('click', () => {
                this.elements.startButton.style.display = 'none';
                this.startTracking();
                this.initDeviceOrientation();
            });
        }

        // Test modus knop
        if (this.elements.testButton) {
            this.elements.testButton.addEventListener('click', () => this.activateTestMode());
        }

        // Toon instructies
        this.updateStatus('Tik op de knop om te starten');

        // Check HTTPS
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            this.updateStatus('⚠️ GPS werkt alleen via HTTPS');
        }
    }

    /**
     * Activeer test modus - simuleer dat je bij het graf bent
     */
    activateTestMode() {
        this.testMode = true;

        // Simuleer een positie vlakbij het graf (3 meter afstand)
        const testLat = CONFIG.grave.latitude + 0.00002;
        const testLon = CONFIG.grave.longitude + 0.00002;

        this.currentPosition = {
            latitude: testLat,
            longitude: testLon,
            accuracy: 5,
            heading: 0
        };

        // Bereken de gesimuleerde afstand
        const distance = this.calculateDistance(
            testLat, testLon,
            CONFIG.grave.latitude, CONFIG.grave.longitude
        );

        this.updateDistance(distance);
        this.updateAccuracy(5);
        this.updateStatus('🧪 TESTMODUS: ' + distance.toFixed(1) + 'm van doel');

        // Trigger "gevonden" na 2 seconden
        setTimeout(() => {
            if (this.testMode) {
                this.handleFound();
            }
        }, 2000);
    }

    /**
     * Initialiseer device orientation voor kompas heading
     */
    initDeviceOrientation() {
        // iOS 13+ vereist permissie
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        this.setupOrientationListener();
                    }
                })
                .catch(err => console.log('Orientation error:', err));
        } else {
            this.setupOrientationListener();
        }
    }

    /**
     * Setup orientation listeners
     */
    setupOrientationListener() {
        // Gebruik absolute orientation als beschikbaar (Android)
        window.addEventListener('deviceorientationabsolute', (e) => {
            this.handleOrientation(e, true);
        }, true);

        // Fallback voor iOS en andere devices
        window.addEventListener('deviceorientation', (e) => {
            this.handleOrientation(e, false);
        }, true);
    }

    /**
     * Handle orientation event
     */
    handleOrientation(e, isAbsolute) {
        let heading = 0;

        // iOS gebruikt webkitCompassHeading (0-360, 0 = noord)
        if (e.webkitCompassHeading !== undefined) {
            heading = e.webkitCompassHeading;
        }
        // Android/andere browsers gebruiken alpha
        else if (e.alpha !== null) {
            if (isAbsolute) {
                // Absolute orientation: alpha is heading van noord
                heading = 360 - e.alpha;
            } else {
                // Relatieve orientation
                heading = 360 - e.alpha;
            }
        }

        // Normaliseer naar 0-360
        heading = ((heading % 360) + 360) % 360;

        // Smooth de heading om schokken te voorkomen
        this.deviceHeading = this.smoothAngle(this.deviceHeading, heading, 0.3);

        this.updateCompassArrow();
    }

    /**
     * Smooth een hoek overgang
     */
    smoothAngle(current, target, factor) {
        // Bereken het kortste pad tussen twee hoeken
        let diff = target - current;

        // Normaliseer verschil naar -180 tot 180
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;

        return current + diff * factor;
    }

    /**
     * Start GPS tracking
     */
    startTracking() {
        if (!('geolocation' in navigator)) {
            this.showError('Je browser ondersteunt geen GPS.');
            return;
        }

        this.gpsStarted = true;
        this.gpsAttempts++;
        this.showScreen('navigation');

        if (this.elements.startButton) {
            this.elements.startButton.style.display = 'none';
        }

        this.startLoadingAnimation();

        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        this.tryGetPosition();
    }

    /**
     * Probeer GPS positie te krijgen
     */
    tryGetPosition() {
        const attempt = this.gpsAttempts;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.handlePosition(position);
                this.startWatching();
            },
            (error) => {
                console.log('GPS poging mislukt:', error.code);
                this.tryHighAccuracy();
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 60000
            }
        );

        setTimeout(() => {
            if (!this.currentPosition && this.gpsStarted && this.gpsAttempts === attempt) {
                this.tryHighAccuracy();
            }
        }, 15000);
    }

    /**
     * Probeer met hoge nauwkeurigheid
     */
    tryHighAccuracy() {
        if (this.currentPosition) return;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.handlePosition(position);
                this.startWatching();
            },
            (error) => this.handleError(error),
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 0
            }
        );
    }

    /**
     * Start continue GPS watching
     */
    startWatching() {
        if (this.watchId) return;

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePosition(position),
            (error) => console.log('Watch error:', error.code),
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 5000
            }
        );
    }

    /**
     * Loading animatie
     */
    startLoadingAnimation() {
        let dots = 0;
        const messages = ['Locatie opvragen', 'GPS signaal zoeken', 'Positie bepalen'];
        let msgIndex = 0;

        if (this.loadingInterval) clearInterval(this.loadingInterval);

        this.loadingInterval = setInterval(() => {
            if (this.currentPosition) {
                clearInterval(this.loadingInterval);
                return;
            }
            dots = (dots + 1) % 4;
            if (dots === 0) msgIndex = (msgIndex + 1) % messages.length;
            this.updateStatus(`${messages[msgIndex]}${'.'.repeat(dots || 1)}`);
        }, 600);
    }

    /**
     * Handle GPS positie
     */
    handlePosition(position) {
        if (this.loadingInterval) clearInterval(this.loadingInterval);
        if (this.testMode) return; // Niet updaten in testmodus

        this.currentPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading
        };

        const distance = this.calculateDistance(
            this.currentPosition.latitude,
            this.currentPosition.longitude,
            CONFIG.grave.latitude,
            CONFIG.grave.longitude
        );

        this.updateDistance(distance);
        this.updateAccuracy(position.coords.accuracy);
        this.updateCompassArrow();

        if (distance <= CONFIG.foundDistance && !this.hasFound) {
            this.handleFound();
        } else if (distance <= CONFIG.nearDistance) {
            this.updateStatus(CONFIG.texts.near, true);
            document.querySelector('.compass').classList.add('near');
        } else {
            this.updateStatus(CONFIG.texts.navigating, false);
            document.querySelector('.compass').classList.remove('near');
        }
    }

    /**
     * Bereken afstand (Haversine)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) ** 2 +
                  Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Bereken bearing naar doel
     */
    calculateBearing(lat1, lon1, lat2, lon2) {
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) -
                  Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        return ((bearing % 360) + 360) % 360;
    }

    /**
     * Update kompas pijl
     */
    updateCompassArrow() {
        if (!this.currentPosition) return;

        // Bearing naar het graf (0 = noord)
        const bearing = this.calculateBearing(
            this.currentPosition.latitude,
            this.currentPosition.longitude,
            CONFIG.grave.latitude,
            CONFIG.grave.longitude
        );

        // Relatieve richting = bearing - device heading
        // Als device naar noord wijst (heading=0) en graf in oosten (bearing=90),
        // dan moet pijl 90 graden naar rechts wijzen
        let rotation = bearing - this.deviceHeading;

        // Normaliseer naar -180 tot 180 voor soepele overgang
        while (rotation > 180) rotation -= 360;
        while (rotation < -180) rotation += 360;

        // Smooth de rotatie
        let diff = rotation - this.lastRotation;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;

        this.lastRotation = this.lastRotation + diff * 0.2;

        this.elements.compassArrow.style.transform =
            `translate(-50%, -100%) rotate(${this.lastRotation}deg)`;
    }

    /**
     * Update afstand display
     */
    updateDistance(distance) {
        const display = distance < 10 ? distance.toFixed(1) : Math.round(distance);
        this.elements.distanceNumber.textContent = display;
    }

    /**
     * Update nauwkeurigheid
     */
    updateAccuracy(accuracy) {
        const display = accuracy < 10 ? `±${accuracy.toFixed(1)}m` : `±${Math.round(accuracy)}m`;
        this.elements.accuracyValue.textContent = display;
    }

    /**
     * Update status bericht
     */
    updateStatus(message, isClose = false) {
        this.elements.statusMessage.innerHTML = `<p>${message}</p>`;
        this.elements.statusMessage.classList.toggle('close', isClose);
    }

    /**
     * Graf gevonden
     */
    handleFound() {
        this.hasFound = true;

        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }

        this.showScreen('found');

        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    /**
     * Handle GPS errors
     */
    handleError(error) {
        if (this.loadingInterval) clearInterval(this.loadingInterval);

        let message = '';
        switch (error.code) {
            case 1:
                message = 'Locatie toegang geweigerd.\n\nGeef toestemming in je instellingen.';
                break;
            case 2:
                message = 'Locatie niet beschikbaar.\n\nGa naar buiten voor beter signaal.';
                break;
            case 3:
                message = 'GPS time-out.\n\nControleer of locatie aan staat.';
                break;
            default:
                message = 'Er ging iets mis. Probeer opnieuw.';
        }

        this.showError(message);
    }

    /**
     * Toon foutmelding
     */
    showError(message) {
        this.gpsStarted = false;
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.style.whiteSpace = 'pre-line';
        this.showScreen('error');
    }

    /**
     * Wissel scherm
     */
    showScreen(screenName) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));

        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
        }

        if (screenName === 'navigation' && !this.gpsStarted) {
            this.hasFound = false;
            this.testMode = false;
            if (this.elements.startButton) {
                this.elements.startButton.style.display = 'block';
            }
            this.updateStatus('Tik op de knop om te starten');
        }
    }
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new GraveFinderApp();
});
