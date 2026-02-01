# In Herinnering aan Aafke - GPS Grave Finder

Een respectvolle webapplicatie die bezoekers via GPS naar de rustplaats van Aafke begeleidt.

## Snel starten

### 1. GPS Coördinaten instellen

Open `config.js` en vervang de coördinaten met de exacte locatie van het graf:

```javascript
grave: {
    latitude: 52.3676,   // Vervang met echte breedtegraad
    longitude: 4.9041,   // Vervang met echte lengtegraad
},
```

**Coördinaten vinden via Google Maps:**
1. Open Google Maps op je telefoon
2. Navigeer naar het graf
3. Houd je vinger lang op de exacte plek
4. De coördinaten verschijnen bovenaan het scherm

### 2. Media toevoegen

Plaats de volgende bestanden in dezelfde map als `index.html`:

| Bestand | Beschrijving |
|---------|-------------|
| `foto-aafke.jpg` | Portretfoto van Aafke |
| `herinnering-aafke.mp4` | Herinneringsvideo |
| `video-poster.jpg` | (optioneel) Thumbnail voor de video |

### 3. Online publiceren

**Optie A: GitHub Pages (gratis)**
1. Upload alle bestanden naar een GitHub repository
2. Ga naar Settings → Pages
3. Selecteer "main" branch en klik Save
4. Je site is beschikbaar op: `https://jouwgebruikersnaam.github.io/aafke`

**Optie B: Netlify (gratis)**
1. Ga naar [netlify.com](https://netlify.com)
2. Sleep de map met bestanden naar de upload zone
3. Je krijgt direct een URL

**Optie C: Eigen domein**
Upload de bestanden naar je eigen webhosting.

## Bestanden overzicht

```
aafke/
├── index.html          # Hoofdpagina
├── style.css           # Styling
├── app.js              # GPS logica
├── config.js           # Instellingen (coördinaten etc.)
├── foto-aafke.jpg      # Toe te voegen: foto
└── herinnering-aafke.mp4  # Toe te voegen: video
```

## Aanpassen

### Teksten wijzigen

In `config.js` kun je alle teksten aanpassen:

```javascript
texts: {
    found: "Je hebt de rustplaats van Aafke gevonden",
    quote: "Voor altijd in onze harten",
    // ... meer teksten
}
```

### Afstand instellen

Standaard opent de herinneringspagina wanneer je binnen 5 meter bent:

```javascript
foundDistance: 5,  // Pas aan indien nodig
```

## Technische vereisten

- Moderne browser met GPS ondersteuning
- HTTPS verbinding (vereist voor GPS toegang)
- Locatieservices ingeschakeld op het apparaat

## Privacy

Deze applicatie:
- Slaat geen locatiegegevens op
- Verzendt geen data naar servers
- Werkt volledig lokaal in de browser
