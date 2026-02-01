/**
 * GPS Grave Finder - Hoofdapplicatie
 * Navigeert de gebruiker naar de rustplaats en toont herinneringen
 */

class GraveFinderApp {
    constructor() {
        this.watchId = null;
        this.currentPosition = null;
        this.hasFound = false;
        this.deviceHeading = null;
        this.gpsStarted = false;

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
            startButton: document.getElementById('start-gps-button')
        };

        this.init();
    }

    init() {
        // Event listeners
        this.elements.retryButton.addEventListener('click', () => this.startTracking());
        this.elements.backButton.addEventListener('click', () => this.showScreen('navigation'));

        // Start knop voor iOS en andere devices die user gesture vereisen
        if (this.elements.startButton) {
            this.elements.startButton.addEventListener('click', () => {
                this.elements.startButton.style.display = 'none';
                this.startTracking();
                this.initDeviceOrientation();
            });
        }

        // Toon instructies
        this.updateStatus('Tik op de knop om te starten');

        // Check of we HTTPS gebruiken (vereist voor GPS)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            this.updateStatus('Let op: GPS werkt alleen via HTTPS');
        }
    }

    /**
     * Initialiseer device orientation voor kompas heading
     */
    initDeviceOrientation() {
        // Vraag permissie op iOS 13+
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        this.setupOrientationListener();
                    }
                })
                .catch(err => {
                    console.log('Orientation permission error:', err);
                });
        } else {
            // Niet-iOS of oudere versies
            this.setupOrientationListener();
        }
    }

    /**
     * Setup de orientation event listener
     */
    setupOrientationListener() {
        window.addEventListener('deviceorientationabsolute', (e) => {
            if (e.alpha !== null) {
                this.deviceHeading = e.alpha;
                this.updateCompassArrow();
            }
        });

        // Fallback voor devices zonder absolute orientation
        window.addEventListener('deviceorientation', (e) => {
            if (this.deviceHeading === null && e.alpha !== null) {
                // webkitCompassHeading is nauwkeuriger op iOS
                this.deviceHeading = e.webkitCompassHeading || e.alpha;
                this.updateCompassArrow();
            }
        });
    }

    /**
     * Start GPS tracking
     */
    startTracking() {
        // Check voor Geolocation ondersteuning
        if (!('geolocation' in navigator)) {
            this.showError('Je browser ondersteunt geen GPS. Probeer een moderne browser.');
            return;
        }

        this.gpsStarted = true;
        this.showScreen('navigation');
        this.updateStatus('GPS wordt gezocht...');

        // Verberg start knop
        if (this.elements.startButton) {
            this.elements.startButton.style.display = 'none';
        }

        // Animeer de loading status
        this.startLoadingAnimation();

        const options = {
            enableHighAccuracy: true,
            timeout: 30000,  // 30 seconden timeout
            maximumAge: 5000 // Cache positie max 5 sec
        };

        // Stop eventuele bestaande watch
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }

        // Start watching position
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePosition(position),
            (error) => this.handleError(error),
            options
        );

        // Fallback: als na 5 seconden nog niets, probeer getCurrentPosition
        setTimeout(() => {
            if (!this.currentPosition && this.gpsStarted) {
                navigator.geolocation.getCurrentPosition(
                    (position) => this.handlePosition(position),
                    (error) => console.log('Fallback GPS error:', error),
                    { enableHighAccuracy: false, timeout: 10000 }
                );
            }
        }, 5000);
    }

    /**
     * Start een loading animatie
     */
    startLoadingAnimation() {
        let dots = 0;
        this.loadingInterval = setInterval(() => {
            if (this.currentPosition) {
                clearInterval(this.loadingInterval);
                return;
            }
            dots = (dots + 1) % 4;
            const dotStr = '.'.repeat(dots);
            this.updateStatus(`GPS wordt gezocht${dotStr}`);
        }, 500);
    }

    /**
     * Handle nieuwe GPS positie
     */
    handlePosition(position) {
        // Stop loading animatie
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
        }

        this.currentPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading
        };

        // Bereken afstand tot het graf
        const distance = this.calculateDistance(
            this.currentPosition.latitude,
            this.currentPosition.longitude,
            CONFIG.grave.latitude,
            CONFIG.grave.longitude
        );

        // Update UI
        this.updateDistance(distance);
        this.updateAccuracy(position.coords.accuracy);
        this.updateCompassArrow();

        // Check of we dichtbij genoeg zijn
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
     * Bereken afstand tussen twee GPS punten (Haversine formule)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Radius van de aarde in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Afstand in meters
    }

    /**
     * Bereken de bearing (richting) naar het doel
     */
    calculateBearing(lat1, lon1, lat2, lon2) {
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) -
                  Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        bearing = (bearing + 360) % 360; // Normaliseer naar 0-360

        return bearing;
    }

    /**
     * Update de kompas pijl richting
     */
    updateCompassArrow() {
        if (!this.currentPosition) return;

        // Bereken de bearing naar het graf
        const bearing = this.calculateBearing(
            this.currentPosition.latitude,
            this.currentPosition.longitude,
            CONFIG.grave.latitude,
            CONFIG.grave.longitude
        );

        // Compenseer voor device heading als beschikbaar
        let rotation = bearing;
        if (this.deviceHeading !== null) {
            rotation = bearing - this.deviceHeading;
        }

        // Update de pijl rotatie
        this.elements.compassArrow.style.transform =
            `translate(-50%, -100%) rotate(${rotation}deg)`;
    }

    /**
     * Update de afstand display
     */
    updateDistance(distance) {
        const displayDistance = distance < 10
            ? distance.toFixed(1)
            : Math.round(distance);

        this.elements.distanceNumber.textContent = displayDistance;
    }

    /**
     * Update de nauwkeurigheid indicator
     */
    updateAccuracy(accuracy) {
        const displayAccuracy = accuracy < 10
            ? `±${accuracy.toFixed(1)}m`
            : `±${Math.round(accuracy)}m`;

        this.elements.accuracyValue.textContent = displayAccuracy;
    }

    /**
     * Update het status bericht
     */
    updateStatus(message, isClose = false) {
        this.elements.statusMessage.innerHTML = `<p>${message}</p>`;
        this.elements.statusMessage.classList.toggle('close', isClose);
    }

    /**
     * Handle wanneer het graf is gevonden
     */
    handleFound() {
        this.hasFound = true;

        // Vibreer als ondersteund (haptic feedback)
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }

        // Toon het gevonden scherm
        this.showScreen('found');

        // Stop GPS tracking om batterij te sparen
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    /**
     * Handle GPS errors
     */
    handleError(error) {
        // Stop loading animatie
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
        }

        let message = '';

        switch (error.code) {
            case 1: // PERMISSION_DENIED
                message = 'Locatie toegang geweigerd. Geef toestemming in je browserinstellingen en herlaad de pagina.';
                break;
            case 2: // POSITION_UNAVAILABLE
                message = 'Locatie niet beschikbaar. Zorg dat je buiten bent voor een goed GPS signaal.';
                break;
            case 3: // TIMEOUT
                message = 'GPS time-out. Controleer of locatieservices aan staan op je telefoon.';
                break;
            default:
                message = 'Er is een fout opgetreden. Controleer je locatie-instellingen en probeer opnieuw.';
        }

        this.showError(message);
    }

    /**
     * Toon foutmelding scherm
     */
    showError(message) {
        this.gpsStarted = false;
        this.elements.errorMessage.textContent = message;
        this.showScreen('error');
    }

    /**
     * Wissel tussen schermen
     */
    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });

        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
        }

        // Als we teruggaan naar navigatie, reset en toon start knop
        if (screenName === 'navigation' && !this.gpsStarted) {
            this.hasFound = false;
            if (this.elements.startButton) {
                this.elements.startButton.style.display = 'block';
            }
            this.updateStatus('Tik op de knop om te starten');
        }
    }
}

// Start de applicatie wanneer de DOM geladen is
document.addEventListener('DOMContentLoaded', () => {
    window.app = new GraveFinderApp();
});
