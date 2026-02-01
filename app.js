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
            backButton: document.getElementById('back-button')
        };

        this.init();
    }

    init() {
        // Event listeners
        this.elements.retryButton.addEventListener('click', () => this.startTracking());
        this.elements.backButton.addEventListener('click', () => this.showScreen('navigation'));

        // Start GPS tracking
        this.startTracking();

        // Probeer device orientation te gebruiken voor kompas
        this.initDeviceOrientation();
    }

    /**
     * Initialiseer device orientation voor kompas heading
     */
    initDeviceOrientation() {
        // Vraag permissie op iOS 13+
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {

            // iOS 13+ vereist een user gesture
            document.body.addEventListener('click', () => {
                DeviceOrientationEvent.requestPermission()
                    .then(response => {
                        if (response === 'granted') {
                            this.setupOrientationListener();
                        }
                    })
                    .catch(console.error);
            }, { once: true });
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

        this.showScreen('navigation');
        this.updateStatus(CONFIG.texts.gpsActivating);

        const options = {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
        };

        // Start watching position
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePosition(position),
            (error) => this.handleError(error),
            options
        );
    }

    /**
     * Handle nieuwe GPS positie
     */
    handlePosition(position) {
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
        let message = '';

        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Locatie toegang geweigerd. Geef toestemming in je browserinstellingen.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Locatie niet beschikbaar. Zorg dat je buiten bent voor een goed GPS signaal.';
                break;
            case error.TIMEOUT:
                message = 'GPS time-out. Controleer of locatieservices aan staan.';
                break;
            default:
                message = 'Er is een onbekende fout opgetreden bij het ophalen van je locatie.';
        }

        this.showError(message);
    }

    /**
     * Toon foutmelding scherm
     */
    showError(message) {
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

        // Als we teruggaan naar navigatie, reset en start tracking opnieuw
        if (screenName === 'navigation') {
            this.hasFound = false;
            if (!this.watchId) {
                this.startTracking();
            }
        }
    }
}

// Start de applicatie wanneer de DOM geladen is
document.addEventListener('DOMContentLoaded', () => {
    window.app = new GraveFinderApp();
});
