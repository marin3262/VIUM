import { useEffect, useRef, useState } from 'react';
import type { ChargingStation } from '../../types';

declare global {
  interface Window {
    kakao: any;
    openStationDetail?: (stationId: string) => void;
    openReportModal?: (stationId: string) => void;
    closeStationOverlay?: () => void;
  }
}

interface StationMapProps {
  stations: ChargingStation[];
  onMarkerClick: (station: ChargingStation) => void;
  isLoading: boolean;
}

export function StationMap({ stations = [], onMarkerClick, isLoading }: StationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const kakaoMapRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const customOverlayRef = useRef<any>(null);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isInitialLoadRef = useRef(true);

  // 1. 카카오 SDK 로드 및 전역 바인딩 (안정적인 ID 기반 통신)
  useEffect(() => {
    window.closeStationOverlay = () => {
      if (customOverlayRef.current) {
        customOverlayRef.current.setMap(null);
      }
    };

    let checkInterval: any;
    let isLoaded = false;

    const initializeKakao = () => {
      if (window.kakao && window.kakao.maps) {
        try {
          window.kakao.maps.load(() => {
            if (!isLoaded) {
              setIsSdkReady(true);
              isLoaded = true;
            }
          });
          return true;
        } catch (e) {
          setError("SDK 로딩 중 내부 오류가 발생했습니다.");
          return false;
        }
      }
      return false;
    };

    if (!initializeKakao()) {
      checkInterval = setInterval(() => {
        if (initializeKakao()) clearInterval(checkInterval);
      }, 500);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      delete window.closeStationOverlay;
    };
  }, []);

  // 2. 지도 초기화
  useEffect(() => {
    if (!isSdkReady || !mapContainerRef.current || kakaoMapRef.current) return;

    try {
      const options = {
        center: new window.kakao.maps.LatLng(37.7853, 127.0457),
        level: 8,
      };
      
      const map = new window.kakao.maps.Map(mapContainerRef.current, options);
      const zoomControl = new window.kakao.maps.ZoomControl();
      map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
      
      window.kakao.maps.event.addListener(map, 'click', () => {
        if (customOverlayRef.current) {
          customOverlayRef.current.setMap(null);
        }
      });

      const clusterer = new window.kakao.maps.MarkerClusterer({
        map: map,
        averageCenter: true,
        minLevel: 6,
        styles: [{
          width: '52px', height: '52px',
          background: 'rgba(59, 130, 246, 0.9)',
          borderRadius: '50%',
          color: '#fff',
          textAlign: 'center',
          fontWeight: '900',
          lineHeight: '52px',
          fontSize: '12px',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
          border: '2px solid white'
        }]
      });

      kakaoMapRef.current = map;
      clustererRef.current = clusterer;
      
      customOverlayRef.current = new window.kakao.maps.CustomOverlay({
        clickable: true,
        yAnchor: 1.15,
        zIndex: 1000 
      });

      const resizeObserver = new ResizeObserver(() => {
        if (kakaoMapRef.current) {
          const center = kakaoMapRef.current.getCenter();
          kakaoMapRef.current.relayout();
          requestAnimationFrame(() => {
            kakaoMapRef.current.setCenter(center);
          });
        }
      });
      resizeObserver.observe(mapContainerRef.current);

      return () => resizeObserver.disconnect();
    } catch (err) {
      setError("지도를 생성할 수 없습니다.");
    }
  }, [isSdkReady]);

  // 3. 마커 업데이트 및 상호작용
  useEffect(() => {
    if (!kakaoMapRef.current || !clustererRef.current || !isSdkReady) return;

    const map = kakaoMapRef.current;
    const clusterer = clustererRef.current;

    clusterer.clear();
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.kakao.maps.LatLngBounds();
    const newMarkers: any[] = [];

    stations.forEach(station => {
      if (!station.latitude || !station.longitude) return;

      const position = new window.kakao.maps.LatLng(station.latitude, station.longitude);
      bounds.extend(position);

      const availableCount = station.chargers?.filter(c => c.status === 'Available').length || 0;
      const markerColor = availableCount > 0 ? '#3B82F6' : '#EF4444';

      const marker = new window.kakao.maps.Marker({
        position,
        title: station.station_name,
      });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        map.panTo(position);
        
        const content = document.createElement('div');
        content.innerHTML = `
          <div style="
            background: #FFFFFF; 
            border-radius: 28px; 
            width: 240px; 
            overflow: hidden; 
            border: 1px solid #E2E8F0; 
            position: relative; 
            box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.2);
          ">
            <div onclick="window.closeStationOverlay()" style="position:absolute; top:16px; right:16px; width:24px; height:24px; border-radius:50%; background:#F1F5F9; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#475569; border:1px solid #E2E8F0; z-index:10;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>

            <div style="padding: 24px;">
              <div style="margin-bottom:12px; padding-right:24px;">
                <div style="font-size:9px; font-weight:900; color:#94A3B8; margin-bottom:2px; letter-spacing:0.1em;">STATION MONITORING</div>
                <div style="font-size:17px; font-weight:900; color:#0F172A; line-height:1.2;">${station.station_name}</div>
              </div>
              
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:20px; background:#F8FAFC; padding:10px 14px; border-radius:14px; border: 1px solid #F1F5F9;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${markerColor};"></span>
                <span style="font-size:12px; font-weight:800; color:${markerColor};">잔여 ${availableCount}석 이용가능</span>
              </div>
              
              <div style="display:flex; gap:8px;">
                <button onclick="window.openStationDetail('${station.station_id}')" style="flex:1.5; padding:14px; background-color:#1E293B; border:none; border-radius:16px; font-size:12px; font-weight:900; color:#FFFFFF; cursor:pointer; transition: all 0.2s; box-shadow: 0 8px 16px rgba(0,0,0,0.1);">
                  상세 정보
                </button>
                <button onclick="window.openReportModal('${station.station_id}')" style="flex:1; padding:14px; background-color:#FFF; border:2px solid #FEE2E2; border-radius:16px; font-size:12px; font-weight:900; color:#EF4444; cursor:pointer; transition: all 0.2s;">
                  고장 제보
                </button>
              </div>
            </div>
            
            <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 16px; height: 16px; background: #FFFFFF; border-right: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0;"></div>
          </div>
        `;
        
        customOverlayRef.current.setContent(content);
        customOverlayRef.current.setPosition(position);
        customOverlayRef.current.setMap(map);
      });

      newMarkers.push(marker);
    });

    clusterer.addMarkers(newMarkers);
    markersRef.current = newMarkers;

    if (stations.length > 0 && isInitialLoadRef.current) {
      map.setBounds(bounds);
      isInitialLoadRef.current = false;
    }
  }, [stations, isSdkReady]);

  return (
    <div className="w-full h-full relative z-0">
      <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0" />
      {!isSdkReady && !error && (
        <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center z-50 backdrop-blur-md">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xs font-black text-blue-600 tracking-[0.2em] uppercase">Initializing Maps...</p>
        </div>
      )}
    </div>
  );
}
