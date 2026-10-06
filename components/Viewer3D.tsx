/**
 * Viewer3D Component - Interactive 3D Model Viewer
 *
 * Uses Online3DViewer library to display 3D models in browser.
 * Supports 15+ formats: GLB, STEP, STL, PLY, OBJ, IGES, FBX, etc.
 *
 * Features:
 * - Interactive rotation, zoom, pan
 * - Multiple view modes (solid, wireframe, shaded)
 * - Measurement tools
 * - Screenshot/export
 * - No plugins required (WebGL)
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as OV from 'online-3d-viewer';

const FLY_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e']);
// Fraction of the initial camera distance moved per frame (about 60 fps).
const FLY_SPEED = 0.006;
const FLY_BOOST = 4;

/**
 * WASD / QE fly on top of Online3DViewer's orbit controls: moves the eye and the
 * orbit centre together, so mouse drag still looks around from the new spot.
 */
function useFlyControls(viewer: any, enabled: boolean) {
  useEffect(() => {
    if (!viewer || !enabled) return;
    const inner = viewer.GetViewer();
    const pressed = new Set<string>();
    let boost = false;
    let frame = 0;
    const start = inner.GetCamera();
    const baseStep = Math.max(OV.CoordDistance3D(start.eye, start.center), 1) * FLY_SPEED;

    const isTyping = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const onDown = (e: KeyboardEvent) => {
      boost = e.shiftKey;
      const key = e.key.toLowerCase();
      if (isTyping(e) || !FLY_KEYS.has(key)) return;
      e.preventDefault();
      pressed.add(key);
    };
    const onUp = (e: KeyboardEvent) => {
      boost = e.shiftKey;
      pressed.delete(e.key.toLowerCase());
    };
    const onBlur = () => pressed.clear();

    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (pressed.size === 0) return;
      const cam = inner.GetCamera();
      const forward = OV.SubCoord3D(cam.center, cam.eye);
      const fLen = OV.VectorLength3D(forward.x, forward.y, forward.z) || 1;
      const f = new OV.Coord3D(forward.x / fLen, forward.y / fLen, forward.z / fLen);
      const r = OV.CrossVector3D(f, cam.up);
      const rLen = OV.VectorLength3D(r.x, r.y, r.z) || 1;
      const u = cam.up;
      const uLen = OV.VectorLength3D(u.x, u.y, u.z) || 1;
      const axis = (k: string) => (pressed.has(k) ? 1 : 0);
      const fwd = axis('w') - axis('s');
      const side = axis('d') - axis('a');
      const lift = axis('e') - axis('q');
      const step = baseStep * (boost ? FLY_BOOST : 1);
      const move = new OV.Coord3D(
        (f.x * fwd + (r.x / rLen) * side + (u.x / uLen) * lift) * step,
        (f.y * fwd + (r.y / rLen) * side + (u.y / uLen) * lift) * step,
        (f.z * fwd + (r.z / rLen) * side + (u.z / uLen) * lift) * step,
      );
      inner.SetCamera(new OV.Camera(OV.AddCoord3D(cam.eye, move), OV.AddCoord3D(cam.center, move), cam.up, cam.fov));
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [viewer, enabled]);
}

interface Viewer3DProps {
  /** URL to the 3D model file */
  modelUrl?: string;
  /** Raw model data as ArrayBuffer */
  modelData?: ArrayBuffer;
  /** File name (used to detect format) */
  fileName?: string;
  /** Container width */
  width?: string | number;
  /** Container height */
  height?: string | number;
  /** Show viewer controls */
  showControls?: boolean;
  /** Background color */
  backgroundColor?: string;
  /** Camera position */
  cameraMode?: 'perspective' | 'orthographic';
  /** Enable measurements */
  enableMeasurements?: boolean;
  /** Callback when model loads */
  onLoad?: () => void;
  /** Callback on load error */
  onError?: (error: Error) => void;
}

export const Viewer3D: React.FC<Viewer3DProps> = ({
  modelUrl,
  modelData,
  fileName,
  width = '100%',
  height = '600px',
  showControls = true,
  backgroundColor = '#ffffff',
  cameraMode = 'perspective',
  enableMeasurements = true,
  onLoad,
  onError,
}) => {
  const { t } = useTranslation();
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flyMode, setFlyMode] = useState(true);
  useFlyControls(loading || error ? null : viewer, flyMode);

  useEffect(() => {
    if (!viewerContainerRef.current) return;

    // Initialize viewer
    const initViewer = async () => {
      try {
        setLoading(true);
        setError(null);

        // Create viewer instance
        const parentDiv = viewerContainerRef.current;
        if (!parentDiv) return;

        // Clear previous content
        parentDiv.innerHTML = '';

        // Initialize viewer
        const viewerInstance = new OV.EmbeddedViewer(parentDiv, {
          backgroundColor: new OV.RGBAColor(
            parseInt(backgroundColor.slice(1, 3), 16),
            parseInt(backgroundColor.slice(3, 5), 16),
            parseInt(backgroundColor.slice(5, 7), 16),
            255
          ),
          defaultColor: new OV.RGBColor(200, 200, 200),
          edgeSettings: new OV.EdgeSettings(false, new OV.RGBColor(0, 0, 0), 1),
        });

        setViewer(viewerInstance);

        // Load model
        if (modelUrl) {
          // Fetch URL as blob first, then load with proper filename
          // This is needed because Online3DViewer can't detect format from URLs without extension
          const response = await fetch(modelUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
          }

          // Get filename from Content-Disposition or use provided fileName
          let actualFileName = fileName || 'model.glb';
          const contentDisposition = response.headers.get('Content-Disposition');
          if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
            if (match && match[1]) {
              actualFileName = match[1];
            }
          }

          // Ensure filename has .glb extension if not present
          if (!actualFileName.toLowerCase().match(/\.(glb|gltf|obj|stl|ply|step|stp|iges|igs|fbx|3ds|3dm|off)$/)) {
            actualFileName = 'model.glb';
          }

          const blob = await response.blob();
          const file = new File([blob], actualFileName, { type: 'model/gltf-binary' });

          console.log('Loading 3D model:', actualFileName, 'Size:', blob.size);
          await viewerInstance.LoadModelFromFileList([file]);

        } else if (modelData && fileName) {
          // Load from ArrayBuffer
          const file = new File([modelData], fileName);
          await viewerInstance.LoadModelFromFileList([file]);
        } else {
          throw new Error('No model URL or data provided');
        }

        setLoading(false);
        if (onLoad) onLoad();

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load 3D model';
        setError(errorMessage);
        setLoading(false);
        if (onError) onError(err instanceof Error ? err : new Error(errorMessage));
        console.error('Viewer3D Error:', err);
      }
    };

    initViewer();

    // Cleanup
    return () => {
      if (viewer) {
        try {
          viewer.Destroy();
        } catch (e) {
          console.warn('Viewer cleanup error:', e);
        }
      }
    };
  }, [modelUrl, modelData, fileName, backgroundColor]);

  // Handle resize
  useEffect(() => {
    if (!viewer) return;

    const handleResize = () => {
      try {
        viewer.Resize();
      } catch (e) {
        console.warn('Viewer resize error:', e);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewer]);

  return (
    <div className="viewer3d-container" style={{ width, height, position: 'relative' }}>
      {/* Loading indicator */}
      {loading && (
        <div className="viewer3d-loading" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          zIndex: 10,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #3498db',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 10px',
            }} />
            <p>{t('common.viewer_loading')}</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && !loading && (
        <div className="viewer3d-error" style={{
          padding: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c00',
        }}>
          <h3>{t('common.viewer_error')}</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Viewer container */}
      <div
        ref={viewerContainerRef}
        style={{
          width: '100%',
          height: '100%',
          border: '1px solid #ddd',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      />

      {/* Controls info */}
      {showControls && !loading && !error && (
        <div className="viewer3d-controls-info" style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          maxWidth: '200px',
        }}>
          <div><strong>{t('common.viewer_controls_title')}</strong></div>
          <div>{t('common.viewer_controls_rotate')}</div>
          <div>{t('common.viewer_controls_pan')}</div>
          <div>{t('common.viewer_controls_zoom')}</div>
          {flyMode && <div>{t('common.viewer_controls_fly')}</div>}
          <button
            type="button"
            onClick={() => setFlyMode((on) => !on)}
            aria-pressed={flyMode}
            style={{
              marginTop: '8px',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.4)',
              background: flyMode ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            {flyMode ? t('common.viewer_fly_on') : t('common.viewer_fly_off')}
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Viewer3D;
