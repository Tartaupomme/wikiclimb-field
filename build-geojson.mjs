// build-geojson.mjs — Fusionne les blocs WikiClimb avec les IDs Boolder
// Match par coordonnees GPS exactes (importees de Boolder)
// Produit wc-blocs.geojson enrichi avec boolderId + photo-groups adaptes

import { readFileSync, writeFileSync } from "fs";

// 1. Charger les blocs Boolder (GeoJSON original)
const boolder = JSON.parse(readFileSync("boolder-blocs.geojson", "utf-8"));
console.log(`Boolder: ${boolder.features.length} blocs`);

// 2. Charger les blocs WC (CSV: id|nom|cotation|lat|lon)
const wcLines = readFileSync("wc-blocs.csv", "utf-8").trim().split("\n");
const wcBlocs = wcLines.map(line => {
  const [id, nom, cotation, lat, lon] = line.split("|");
  return { id, nom, cotation, lat: parseFloat(lat), lon: parseFloat(lon) };
});
console.log(`WikiClimb: ${wcBlocs.length} blocs`);

// 3. Index Boolder par coords arrondies (6 decimales = ~0.11m)
const boolderByCoords = new Map();
for (const f of boolder.features) {
  const [lon, lat] = f.geometry.coordinates;
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  boolderByCoords.set(key, f.properties);
}

// 4. Matcher WC -> Boolder par coords
let matched = 0, unmatched = 0;
const features = [];
const wcIdToBoolderId = new Map(); // pour adapter les photo-groups

for (const wc of wcBlocs) {
  const key = `${wc.lat.toFixed(5)},${wc.lon.toFixed(5)}`;
  const bp = boolderByCoords.get(key);

  const properties = {
    id: wc.id,
    name: wc.nom,
    grade: wc.cotation,
  };

  if (bp) {
    properties.boolderId = bp.id;
    if (bp.url) properties.boolderUrl = bp.url;
    wcIdToBoolderId.set(wc.id, bp.id);
    matched++;
  } else {
    unmatched++;
  }

  features.push({
    type: "Feature",
    geometry: { type: "Point", coordinates: [wc.lon, wc.lat] },
    properties,
  });
}

console.log(`Matches: ${matched}, sans match Boolder: ${unmatched}`);

// 5. Ecrire le GeoJSON enrichi
writeFileSync("wc-blocs.geojson", JSON.stringify({ type: "FeatureCollection", features }));
console.log(`wc-blocs.geojson ecrit (${features.length} features)`);

// 6. Adapter les photo-groups (Boolder IDs -> WC IDs)
// Un boolderId peut correspondre a PLUSIEURS WC IDs (ex: "Bloc" et "Bloc (assis)"
// sur les memes coords GPS). On garde TOUS les WC IDs par boolderId.
const boolderIdToWcIds = new Map();
for (const [wcId, bId] of wcIdToBoolderId) {
  if (!boolderIdToWcIds.has(bId)) boolderIdToWcIds.set(bId, []);
  boolderIdToWcIds.get(bId).push(wcId);
}

const photoGroups = JSON.parse(readFileSync("photo-groups.json", "utf-8"));
const wcGroups = photoGroups
  .map(group => {
    // Chaque boolderId peut donner plusieurs WC IDs -> on les expanse tous
    const wcIds = [];
    for (const bId of group) {
      const ids = boolderIdToWcIds.get(bId);
      if (ids) wcIds.push(...ids);
    }
    return wcIds;
  })
  .filter(g => g.length >= 2); // garder les groupes avec au moins 2 blocs

writeFileSync("photo-groups-wc.json", JSON.stringify(wcGroups));
console.log(`photo-groups-wc.json: ${wcGroups.length} groupes (${photoGroups.length} originaux)`);
