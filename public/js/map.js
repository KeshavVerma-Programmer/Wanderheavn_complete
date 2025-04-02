import { Map, Marker, Popup } from 'maplibre-gl'; // Correct v5.x import

document.addEventListener("DOMContentLoaded", () => {
    if (listing?.geometry?.coordinates) {
        const map = new Map({
            container: 'map',
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapToken}`,
            center: listing.geometry.coordinates,
            zoom: 9
        });

        new Marker({ color: "red" })
            .setLngLat(listing.geometry.coordinates)
            .setPopup(
                new Popup().setHTML(
                    `<h4>${listing.title}</h4>
                    <p>${listing.location}</p>
                    <p>Exact location will be provided after booking</p>`
                )
            )
            .addTo(map);
    } else {
        console.error("Map coordinates are missing or invalid.");
    }
});






