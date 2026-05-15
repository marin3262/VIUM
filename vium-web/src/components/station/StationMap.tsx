import { useEffect, useRef, useState, useCallback } from "react";
import { useStationStore } from "../../store/stationStore";
import type { ChargingStation } from "../../types";

interface StationMapProps {
  stations: ChargingStation[];
  onMarkerClick: (station: ChargingStation) => void;
  onMapClick?: () => void;
  isLoading: boolean;
}

declare global {
  interface Window {
    kakao: any;
    focusStationOnMap: (stationId: string) => void;
  }
}

interface MarkerState {
  marker: any;
  uri: string;
}

export function StationMap({ stations, onMarkerClick, onMapClick, isLoading }: StationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const clustererInstance = useRef<any>(null);
  const markersRef = useRef<Map<string, MarkerState>>(new Map());
  const [isReady, setIsReady] = useState(false);
  
  const [isUserDragging, setIsUserDragging] = useState(false); // 드래그 중 업데이트 방지
  const { getAvailableSlots } = useStationStore();

  // 1. 카카오 지도 API 로드 대기
  useEffect(() => {
    const initMap = () => {
      window.kakao.maps.load(() => {
        setIsReady(true);
      });
    };

    if (window.kakao && window.kakao.maps) {
      if (window.kakao.maps.Map) {
        setIsReady(true);
      } else {
        initMap();
      }
    } else {
      const check = setInterval(() => {
        if (window.kakao && window.kakao.maps) {
          initMap();
          clearInterval(check);
        }
      }, 300);
      return () => clearInterval(check);
    }
  }, []);

  // 2. 동적 SVG 마커 이미지 생성 함수
  const createSvgMarkerUri = useCallback((available: number, total: number, chargers: any[]) => {
    let color = '#2563eb';
    if (available === 0) {
      const isAllFaulty = chargers.length > 0 && chargers.every(c => c.status === 'Faulty');
      if (isAllFaulty) color = '#ef4444';
      else color = '#f97316';
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
        <circle cx="23" cy="23" r="19" fill="rgba(0,0,0,0.1)"/>
        <circle cx="23" cy="23" r="18" fill="white" stroke="rgba(0,0,0,0.05)" stroke-width="1"/>
        <circle cx="23" cy="23" r="15" fill="${color}"/>
        <text x="23" y="27" font-family="Pretendard, sans-serif" font-weight="900" font-size="12" fill="white" text-anchor="middle">
          ${available}<tspan font-size="8" font-weight="400" opacity="0.7">/${total}</tspan>
        </text>
      </svg>
    `.trim();

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, []);

  // 3. 지도 및 클러스터러 초기화
  useEffect(() => {
    if (!isReady || !container.current) return;

    if (!mapInstance.current) {
      const options = {
        center: new window.kakao.maps.LatLng(37.7853, 127.0457),
        level: 8,
        draggable: true,
        scrollwheel: true,
      };
      const map = new window.kakao.maps.Map(container.current, options);
      mapInstance.current = map;

      // 상호작용 감지
      window.kakao.maps.event.addListener(map, 'dragstart', () => setIsUserDragging(true));
      window.kakao.maps.event.addListener(map, 'dragend', () => setIsUserDragging(false));
      window.kakao.maps.event.addListener(map, 'click', () => {
        if (onMapClick) onMapClick();
      });

      const clusterer = new window.kakao.maps.MarkerClusterer({
        map: map,
        averageCenter: true,
        minLevel: 2, // 아주 낮은 레벨까지 클러스터링 유지
        styles: [{
          width: '52px', height: '52px',
          background: 'rgba(37, 99, 235, 0.9)',
          color: '#fff',
          textAlign: 'center',
          lineHeight: '52px',
          borderRadius: '26px',
          fontWeight: '900',
          fontSize: '14px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
          border: '2px solid white',
          backdropFilter: 'blur(4px)'
        }]
      });
      clustererInstance.current = clusterer;

      window.focusStationOnMap = (stationId: string) => {
        const target = useStationStore.getState().stations.find(s => s.station_id === stationId);
        if (target && mapInstance.current) {
          const lat = Number(target.latitude);
          const lng = Number(target.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            const pos = new window.kakao.maps.LatLng(lat, lng);
            mapInstance.current.setCenter(pos);
            mapInstance.current.setLevel(3);
          }
        }
      };

      let animationFrame: number;
      let startTime: number;
      
      const syncMapSize = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        
        if (mapInstance.current) {
          mapInstance.current.relayout();
          const center = mapInstance.current.getCenter();
          const nudge = (progress % 2 === 0) ? 0.000001 : -0.000001;
          mapInstance.current.setCenter(new window.kakao.maps.LatLng(center.getLat() + nudge, center.getLng()));
        }
        
        if (progress < 600) {
          animationFrame = requestAnimationFrame(syncMapSize);
        } else {
          startTime = 0;
          
          if (mapInstance.current) mapInstance.current.relayout();
        }
      };

      const resizeObserver = new ResizeObserver(() => {
        if (mapInstance.current) {
          
          cancelAnimationFrame(animationFrame);
          startTime = 0;
          animationFrame = requestAnimationFrame(syncMapSize);
        }
      });
      resizeObserver.observe(container.current);

      return () => {
        resizeObserver.disconnect();
        cancelAnimationFrame(animationFrame);
      };
    }
  }, [isReady, onMapClick]);

  // 4. 차분 업데이트 기반 마커 관리 (Jittering 및 타입 안전성 확보)
  useEffect(() => {
    if (!mapInstance.current || !clustererInstance.current || !isReady) return;
    
    // 드래그 중에는 업데이트 지연
    if (isUserDragging && markersRef.current.size > 0) return;

    const clusterer = clustererInstance.current;
    const currentMarkersMap = markersRef.current;
    const nextStationIds = new Set(stations.map(s => s.station_id));

    // 4.1 필터링 제외 마커 제거
    const markersToRemove: any[] = [];
    for (const [id, state] of currentMarkersMap.entries()) {
      if (!nextStationIds.has(id)) {
        markersToRemove.push(state.marker);
        state.marker.setMap(null); 
        currentMarkersMap.delete(id);
      }
    }
    
    if (markersToRemove.length > 0) {
      clusterer.removeMarkers(markersToRemove);
    }

    // 4.2 Jittering 알고리즘 적용 및 업데이트
    const markersToAdd: any[] = [];
    const coordCounts = new Map<string, number>();

    stations.forEach(station => {
      // [보안] 위경도 타입 안전성 체크 및 강제 변환
      const rawLat = Number(station.latitude);
      const rawLng = Number(station.longitude);
      
      if (isNaN(rawLat) || isNaN(rawLng)) {
        console.warn(`[StationMap] Invalid coordinates for station: ${station.station_id}`);
        return; // 유효하지 않은 좌표는 렌더링 스킵
      }

      const coordKey = `${rawLat.toFixed(6)},${rawLng.toFixed(6)}`;
      const samePosCount = coordCounts.get(coordKey) || 0;
      coordCounts.set(coordKey, samePosCount + 1);

      let finalLat = rawLat;
      let finalLng = rawLng;

      if (samePosCount > 0) {
        const angle = (samePosCount * 137.5) * (Math.PI / 180);
        const radius = 0.00004 * Math.sqrt(samePosCount);
        finalLat += radius * Math.cos(angle);
        finalLng += radius * Math.sin(angle);
      }

      const available = getAvailableSlots(station);
      const total = station.chargers.length;
      const markerUri = createSvgMarkerUri(available, total, station.chargers);
      
      const existingState = currentMarkersMap.get(station.station_id);

      if (existingState) {
        if (existingState.uri !== markerUri) {
          const markerImage = new window.kakao.maps.MarkerImage(
            markerUri,
            new window.kakao.maps.Size(46, 46),
            { offset: new window.kakao.maps.Point(23, 23) }
          );
          existingState.marker.setImage(markerImage);
          existingState.uri = markerUri;
        }
        
        const newPos = new window.kakao.maps.LatLng(finalLat, finalLng);
        if (!existingState.marker.getPosition().equals(newPos)) {
          existingState.marker.setPosition(newPos);
        }

        if (existingState.marker.getMap() === null) {
          markersToAdd.push(existingState.marker);
        }
      } else {
        const pos = new window.kakao.maps.LatLng(finalLat, finalLng);
        const markerImage = new window.kakao.maps.MarkerImage(
          markerUri,
          new window.kakao.maps.Size(46, 46),
          { offset: new window.kakao.maps.Point(23, 23) }
        );

        const marker = new window.kakao.maps.Marker({
          position: pos,
          image: markerImage,
          zIndex: 3
        });

        window.kakao.maps.event.addListener(marker, 'click', () => {
          onMarkerClick(station);
        });

        currentMarkersMap.set(station.station_id, { marker, uri: markerUri });
        markersToAdd.push(marker);
      }
    });

    if (markersToAdd.length > 0) {
      clusterer.addMarkers(markersToAdd);
    }

    if (markersToRemove.length > 0 || markersToAdd.length > 0) {
      if (clusterer.repaint) clusterer.repaint();
    }

  }, [stations, isReady, onMarkerClick, getAvailableSlots, createSvgMarkerUri, isUserDragging]);

  return (
    <div className="w-full h-full relative" style={{ minHeight: '300px' }}>
      <div 
        ref={container} 
        className="w-full h-full" 
        style={{ 
          width: '100%', 
          height: '100%', 
          background: '#f8fafc',
          willChange: 'transform',
          transform: 'translateZ(0)' 
        }} 
      />
      {!isReady && (
        <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Map Loading...</p>
          </div>
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-black text-blue-600 uppercase tracking-widest">Updating Map...</p>
          </div>
        </div>
      )}
    </div>
  );
}
