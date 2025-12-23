import React, { useState, useEffect } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";

const geoUrl = "/world.geojson";

interface Props {
  onCountryClick: (countryName: string) => void;
}

export const InteractiveMap: React.FC<Props> = ({ onCountryClick }) => {
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    fetch(geoUrl)
      .then((res) => res.json())
      .then((data) => setGeoData(data))
      .catch((err) => console.error("Kunde inte ladda kartan:", err));
  }, []);

  if (!geoData) return <div className="text-white text-2xl p-10">Laddar karta...</div>;

  return (
    <div className="w-full h-full bg-[#0B1120] relative flex items-center justify-center overflow-hidden">
      
      <ComposableMap 
        projection="geoMercator"
        projectionConfig={{
          scale: 140, // Lite mer inzoomad start
        }}
        width={800}
        height={500}
        style={{ width: "100%", height: "100%" }}
      >
          {/* Zoom är tillbaka! MaxZoom 8 gör att du kan komma riktigt nära */}
          <ZoomableGroup center={[0, 20]} zoom={1} minZoom={1} maxZoom={12}>
            <Geographies geography={geoData}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey || geo.properties.name}
                    geography={geo}
                    
                    // Klick-logik
                    onClick={() => {
                      console.log(`Valt: ${geo.properties.name}`);
                      onCountryClick(geo.properties.name);
                    }}

                    style={{
                      default: { fill: "#374151", outline: "none", stroke: "#6B7280", strokeWidth: 0.5 },
                      // Hover: Lyser upp gult men INGEN TEXTRUTA visas
                      hover: { fill: "#FBBF24", outline: "none", stroke: "#FFF", strokeWidth: 1.5, cursor: "crosshair" },
                      pressed: { fill: "#EF4444", outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>
          </ZoomableGroup>
      </ComposableMap>

      {/* Instruktion i hörnet */}
      <div className="absolute bottom-6 right-6 pointer-events-none bg-black/50 text-white/50 px-4 py-2 rounded-full text-sm backdrop-blur-md">
         Scroll to Zoom • Point to Guess
      </div>
    </div>
  );
};