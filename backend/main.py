from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
from ultralytics import YOLO
import yt_dlp
import uuid

app = FastAPI(title="Badminton Analytics Processing Engine")

# Configure CORS so your Vercel web application can securely fetch data
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with your actual Vercel domain URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global memory state to track async processing tasks without database overhead
jobs = {}

class CalibrationRequest(BaseModel):
    video_url: str
    points: list  # Expected format: [[x1, y1], ... [x8, y8]]

def get_stream_url(url):
    ydl_opts = {'format': 'best[ext=mp4]/best', 'quiet': True, 'no_warnings': True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        return ydl.extract_info(url, download=False)['url']

def background_vision_processor(job_id: str, stream_url: str, points: list):
    try:
        model = YOLO("yolov8n.pt") # Runs reliably on CPU instances
        cap = cv2.VideoCapture(stream_url)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 27000
        
        src_top = np.float32([points[0], points[1], points[3], points[4]])
        dst_top = np.float32([[0, 0], [3.05, 0], [0, 6.7], [3.05, 6.7]])
        H_top = cv2.getPerspectiveTransform(src_top, dst_top)
        
        src_bottom = np.float32([points[3], points[4], points[5], points[7]])
        dst_bottom = np.float32([[0, 6.7], [3.05, 6.7], [0, 13.4], [3.05, 13.4]])
        H_bottom = cv2.getPerspectiveTransform(src_bottom, dst_bottom)
        
        frame_idx = 0
        frame_step = 3  # Performance sampling skip optimized for production speeds
        
        quadrants = {"Box1": 0, "Box2": 0, "Box3": 0, "Box4": 0}
        trajectory_log = []
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            frame_idx += 1
            if frame_idx % frame_step != 0: continue
            
            # Send live progress state telemetry updates
            if frame_idx % 90 == 0:
                jobs[job_id]["progress"] = round((frame_idx / total_frames) * 100, 1)
                
            results = model.track(frame, persist=True, verbose=False)
            if results[0].boxes.id is not None:
                boxes = results[0].boxes.xyxy.cpu().numpy()
                class_ids = results[0].boxes.cls.int().cpu().numpy()
                
                for box, cls in zip(boxes, class_ids):
                    if cls in [0, 32, 38]:
                        px = int((box[0] + box[2]) / 2)
                        py = int(box[3]) if cls == 0 else int((box[1] + box[3]) / 2)
                        
                        pixel_vector = np.array([px, py, 1.0]).reshape(3, 1)
                        midline_y = (points[3][1] + points[4][1]) / 2
                        
                        if py < midline_y:
                            trans = np.dot(H_top, pixel_vector)
                            scale = trans[2, 0]
                            if scale != 0:
                                cx, cy = trans[0, 0]/scale, trans[1, 0]/scale
                                if 0 <= cx <= 6.1 and 0 <= cy <= 6.7:
                                    trajectory_log.append({"x": float(cx), "y": float(cy)})
                                    if cx < 3.05: quadrants["Box1"] += 1
                                    else: quadrants["Box2"] += 1
                        else:
                            trans = np.dot(H_bottom, pixel_vector)
                            scale = trans[2, 0]
                            if scale != 0:
                                cx, cy = trans[0, 0]/scale, trans[1, 0]/scale
                                if 0 <= cx <= 6.1 and 6.7 <= cy <= 13.4:
                                    trajectory_log.append({"x": float(cx), "y": float(cy)})
                                    if cx < 3.05: quadrants["Box3"] += 1
                                    else: quadrants["Box4"] += 1
        cap.release()
        
        # Job marked complete. Save metrics to internal RAM dictionary map state.
        jobs[job_id] = {
            "status": "COMPLETED",
            "progress": 100.0,
            "quadrants": quadrants,
            "trajectory": trajectory_log
        }
    except Exception as e:
        jobs[job_id] = {"status": "FAILED", "error": str(e)}

@app.post("/api/analyze")
def start_analysis(payload: CalibrationRequest, background_tasks: BackgroundTasks):
    try:
        stream_url = get_stream_url(payload.video_url)
    except Exception as network_err:
        raise HTTPException(status_code=400, detail=f"Failed to fetch YouTube stream: {network_err}")
        
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "PROCESSING", "progress": 0.0}
    
    # Hand off long-running compute jobs securely to a non-blocking background thread worker
    background_tasks.add_task(background_vision_processor, job_id, stream_url, payload.points)
    return {"job_id": job_id, "status": "QUEUED"}

@app.get("/api/status/{job_id}")
def check_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Requested analytics profiling job tracking token not found.")
    return jobs[job_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)