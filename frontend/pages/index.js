import { useState, useRef, useEffect } from 'react';

export default function BadmintonIntelligenceLab() {
  const [videoUrl, setVideoUrl] = useState('');
  const [points, setPoints] = useState([]);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  
  // Update this URL string with the production deployment location of your FastAPI server
  const BACKEND_API = "http://YOUR_BACKEND_VPS_IP_OR_URL:8000"; 
  
  // Safe point click handler capturing raw visual element dimension scales
  const handleImageClick = (e) => {
    if (points.length >= 8) return;
    const rect = e.target.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    setPoints([...points, [x, y]]);
  };

  const startAnalyticsEngine = async () => {
    if (points.length !== 8) return alert("Please map all 8 field calibration nodes before execution.");
    
    const res = await fetch(`${BACKEND_API}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url: videoUrl, points: points })
    });
    const data = await res.json();
    if (data.job_id) {
      setJobId(data.job_id);
      setStatus("PROCESSING");
    }
  };

  // Asynchronous status polling worker synchronization loop
  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`${BACKEND_API}/api/status/${jobId}`);
      const data = await res.json();
      
      setStatus(data.status);
      if (data.progress) setProgress(data.progress);
      
      if (data.status === "COMPLETED" || data.status === "FAILED") {
        clearInterval(interval);
        if (data.status === "COMPLETED") setStatus(data);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">🏸 Badminton Match Performance Lab</h1>
          <p className="text-slate-400">Decoupled full-stack tactical mapping analysis pipeline.</p>
        </header>

        {/* Input Matrix Setup View Panel */}
        <div className="bg-slate-800 p-6 rounded-lg shadow-xl mb-8">
          <label className="block text-sm font-medium text-slate-300 mb-2">YouTube Performance Video Link</label>
          <input 
            type="text" 
            placeholder="https://www.youtube.com/watch?v=..." 
            className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-emerald-500 transition"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
        </div>

        {/* Dynamic Multi-Step Calibration Layout Context Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-800 p-6 rounded-lg shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-white">🎯 Dynamic Geometric Calibration Map</h2>
            <div className="relative inline-block overflow-hidden rounded bg-slate-950 border border-slate-700">
              {/* Replace placeholder below with a dynamic video thumbnail frame generator as desired */}
              <div 
                className="w-[640px] h-[360px] bg-emerald-950 flex items-center justify-center cursor-crosshair relative select-none text-slate-500"
                onClick={handleImageClick}
              >
                Click inside here to map your 8 court coordinate markers mock space
                
                {points.map((pt, i) => (
                  <div 
                    key={i} 
                    className="absolute w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                    style={{ left: pt[0]-8, top: pt[1]-8 }}
                  >
                    {i+1}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-4 flex gap-4 items-center">
              <button 
                onClick={() => setPoints([])}
                className="px-4 py-2 border border-slate-600 rounded text-slate-300 hover:bg-slate-700 transition"
              >
                Reset Calibration Points
              </button>
              <button 
                onClick={startAnalyticsEngine}
                disabled={points.length !== 8 || status === "PROCESSING"}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded transition disabled:opacity-50"
              >
                {status === "PROCESSING" ? `Processing (${progress}%)` : "🚀 Run Spatial Match Analytics"}
              </button>
            </div>
          </div>

          {/* Performance Data Summary Display Dashboard */}
          <div className="bg-slate-800 p-6 rounded-lg shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-white">📊 Dashboard Telemetry Insights</h2>
            
            {status === "PROCESSING" && (
              <div className="space-y-4">
                <p className="text-amber-400 font-medium animate-pulse">Processing Computer Vision Framework Video Streams...</p>
                <div className="w-full bg-slate-700 h-2 rounded overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}

            {status && status.status === "COMPLETED" && (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-950 border border-emerald-800 rounded">
                  <h3 className="text-emerald-400 font-semibold text-sm">Automated Match Analytics Profile Complete</h3>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Spatial Quadrant Metrics</h4>
                  {Object.entries(status.quadrants).map(([box, count]) => (
                    <div key={box} className="flex justify-between border-b border-slate-700 pb-2 text-sm">
                      <span className="text-slate-300 font-medium">{box} Distribution</span>
                      <span className="text-white font-bold">{count} Hits</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!status && <p className="text-slate-500 text-sm">Await tracking execution initialization mapping configurations to build analytics.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}