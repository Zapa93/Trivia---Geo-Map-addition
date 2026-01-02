import React, { memo } from 'react';
import { ComposableMap, Geographies, Geography, Graticule, Sphere, ZoomableGroup } from 'react-simple-maps';
import geoData from '../assets/world.json'; 

interface InteractiveMapProps {
  onCountryClick?: (countryName: string) => void;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = memo(({ onCountryClick }) => {
  return (
    <div className="w-full h-full bg-[#0B1120] flex items-center justify-center overflow-hidden rounded-3xl border-4 border-slate-700 relative">
      
      {/* will-change hjälper TVns grafikkort */}
      <div className="w-full h-full" style={{ willChange: 'transform' }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 120,
            center: [0, 0]
          }}
          className="w-full h-full z-10"
        >
          <ZoomableGroup 
            center={[0, 0]} 
            zoom={1} 
            minZoom={0.7} 
            maxZoom={10}
          >
            <Sphere stroke="#1e293b" strokeWidth={2} id="rsm-sphere" fill="#0f172a" />
            <Graticule stroke="#1e293b" strokeWidth={0.5} />

            <Geographies geography={geoData}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryName = geo.properties.name || "Unknown";
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => {
                        if (onCountryClick) onCountryClick(countryName);
                      }}
                      style={{
                        default: {
                          fill: "#334155",
                          stroke: "#0f172a",
                          strokeWidth: 0.5,
                          outline: "none"
                          // Inga transitions!
                        },
                        hover: {
                          fill: "#3b82f6", // Enkel färgändring
                          stroke: "#fff",
                          strokeWidth: 1, 
                          outline: "none",
                          cursor: "pointer"
                          // Inga drop-shadows!
                        },
                        pressed: {
                          fill: "#22c55e",
                          stroke: "#fff",
                          strokeWidth: 2,
                          outline: "none"
                        }
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>
    </div>
  );
});