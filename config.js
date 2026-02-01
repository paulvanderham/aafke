/**
 * Configuratie voor de GPS Grave Finder
 *
 * INSTRUCTIES:
 * Pas de onderstaande coördinaten aan naar de exacte locatie van het graf.
 * Je kunt de coördinaten vinden via Google Maps:
 * 1. Open Google Maps op je telefoon
 * 2. Houd je vinger lang op de exacte plek van het graf
 * 3. De coördinaten verschijnen bovenaan het scherm
 * 4. Kopieer deze naar hieronder
 */

const CONFIG = {
    // GPS coördinaten van het graf
    grave: {
        latitude: 52.546352,
        longitude: 6.457746,
    },

    // Afstand in meters waarbij de "gevonden" pagina wordt getoond
    foundDistance: 5,

    // Afstand waarbij een "je bent dichtbij" melding verschijnt
    nearDistance: 20,

    // Naam van de persoon (wordt gebruikt in berichten)
    name: "Aafke",

    // Update interval voor GPS in milliseconden
    updateInterval: 1000,

    // Teksten die je kunt aanpassen
    texts: {
        found: "Je hebt de rustplaats van Aafke gevonden",
        quote: "Voor altijd in onze harten",
        navigating: "Volg de pijl naar de rustplaats",
        near: "Je bent heel dichtbij...",
        gpsActivating: "GPS wordt geactiveerd...",
        walkDirection: "Loop in de richting van de pijl"
    }
};
