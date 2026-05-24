import { useEffect, useRef, useState, useCallback } from "react";
import { Compass, Navigation, Clock, Flag, X } from "lucide-react";
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
  const { 
    getAvailableSlots, 
    userLocation, 
    routePath, 
    routeSummary, 
    clearRoute, 
    setUserLocation 
  } = useStationStore();

  const userMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // 내 위치 잡기 핸들러
  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const pos = { lat: latitude, lng: longitude };
        setUserLocation(pos);
        
        if (mapInstance.current) {
          mapInstance.current.setCenter(new window.kakao.maps.LatLng(latitude, longitude));
          mapInstance.current.setLevel(4);
        }
      },
      (error) => console.error(error),
      { enableHighAccuracy: true }
    );
  };

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

  // 5. 내 위치 마커 및 경로(Polyline) 렌더링
  useEffect(() => {
    if (!isReady || !mapInstance.current) return;

    const map = mapInstance.current;

    // 5.1 내 위치 마커 관리
    if (userLocation) {
      const pos = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng);
      
      if (!userMarkerRef.current) {
        // 커스텀 SVG 마커 (내 위치) - 파란색 펄스 효과
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="#3b82f6" fill-opacity="0.2">
              <animate attributeName="r" from="8" to="16" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="fill-opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="18" cy="18" r="6" fill="#3b82f6" stroke="white" stroke-width="2" />
          </svg>
        `.trim();
        
        const markerImage = new window.kakao.maps.MarkerImage(
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
          new window.kakao.maps.Size(36, 36),
          { offset: new window.kakao.maps.Point(18, 18) }
        );

        const marker = new window.kakao.maps.Marker({
          position: pos,
          image: markerImage,
          zIndex: 10
        });
        marker.setMap(map);
        userMarkerRef.current = marker;
      } else {
        userMarkerRef.current.setPosition(pos);
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }

    // 5.2 경로(Polyline) 관리
    if (routePath && routePath.length > 0) {
      // routePath는 [[lng, lat], ...] 형태이므로 변환 시 주의
      const path = routePath.map(p => new window.kakao.maps.LatLng(p[1], p[0]));
      
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }

      const polyline = new window.kakao.maps.Polyline({
        path: path,
        strokeWeight: 6,
        strokeColor: '#6366f1',
        strokeOpacity: 0.9,
        strokeStyle: 'solid'
      });
      
      polyline.setMap(map);
      polylineRef.current = polyline;

      // 5.3 경로가 화면에 다 들어오도록 Bounds 조정
      const bounds = new window.kakao.maps.LatLngBounds();
      path.forEach(pos => bounds.extend(pos));
      map.setBounds(bounds, 80, 80, 80, 80); // 상하좌우 여백 80px 부여
    } else if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

  }, [isReady, userLocation, routePath]);

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
      {isLoading && stations.length === 0 && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-black text-blue-600 uppercase tracking-widest">Updating Map...</p>
          </div>
        </div>
      )}

      {/* 내 위치 버튼 */}
      <button 
        onClick={handleMyLocation}
        className="absolute bottom-6 right-6 z-30 w-12 h-12 bg-white rounded-2xl shadow-xl border border-gray-100 flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-all active:scale-95"
        title="내 위치 찾기"
      >
        <Compass size={24} />
      </button>

      {/* [UX 개편] 주행 요약 대시보드 (하단 중앙) */}
      {routeSummary && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-48px)] max-w-sm bg-white/90 backdrop-blur-md rounded-[32px] shadow-2xl border border-white/20 p-5 animate-in slide-in-from-bottom-10 duration-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                <Navigation size={18} fill="currentColor" />
              </div>
              <h4 className="text-sm font-black text-gray-900">길찾기 주행 모드</h4>
            </div>
            <button 
              onClick={clearRoute}
              className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Clock size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">예상 시간</span>
              </div>
              <p className="text-xl font-black text-indigo-600">
                {Math.round(routeSummary.duration / 60)}<span className="text-sm font-bold ml-0.5">분</span>
              </p>
            </div>

            <div className="w-px h-8 bg-gray-100" />

            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Flag size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">남은 거리</span>
              </div>
              <p className="text-xl font-black text-gray-900">
                {(routeSummary.distance / 1000).toFixed(1)}<span className="text-sm font-bold ml-0.5">km</span>
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-400 truncate max-w-[200px]">
              목적지: {routeSummary.destinationName || '선택한 충전소'}
            </p>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse delay-75" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-100 animate-pulse delay-150" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
