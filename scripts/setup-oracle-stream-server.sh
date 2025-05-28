#!/bin/bash

# Oracle Cloud Stream Server Setup Script
set -e

echo "🚀 Setting up Stream Processing Server on Oracle Cloud..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root"
    exit 1
fi

# Get server details
echo "📝 Please provide your server details:"
read -p "Oracle VM Public IP: " PUBLIC_IP

# Validate inputs
if [ -z "$PUBLIC_IP" ]; then
    print_error "Public IP is required"
    exit 1
fi

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js and npm
print_status "Installing Node.js and npm..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python and OpenCV dependencies
print_status "Installing Python and AI processing dependencies..."
sudo apt install -y python3 python3-pip python3-venv
sudo apt install -y libopencv-dev python3-opencv
sudo apt install -y ffmpeg

# Install additional AI libraries
print_status "Installing AI processing libraries..."
pip3 install --user opencv-python mediapipe tensorflow numpy websockets

# Create project directory
print_status "Creating stream server directory..."
mkdir -p ~/stream-server
cd ~/stream-server

# Create package.json
print_status "Creating Node.js stream server..."
cat > package.json << EOF
{
  "name": "oracle-stream-server",
  "version": "1.0.0",
  "description": "AI-powered video stream processing server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "ws": "^8.14.2",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF

# Install Node.js dependencies
print_status "Installing Node.js dependencies..."
npm install

# Create main server file
print_status "Creating stream processing server..."
cat > server.js << 'EOF'
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    activeStreams: activeStreams.size,
    server: 'Oracle Cloud Stream Processor'
  });
});

// Stream info endpoint
app.get('/streams', (req, res) => {
  const streams = Array.from(activeStreams.entries()).map(([id, stream]) => ({
    id,
    userId: stream.userId,
    startTime: stream.startTime,
    filters: stream.filters
  }));
  res.json({ streams });
});

// WebSocket server for real-time communication
const wss = new WebSocket.Server({ server });

// Store active streams and connections
const activeStreams = new Map();
const connections = new Map();

wss.on('connection', (ws, req) => {
  const clientId = generateId();
  connections.set(clientId, ws);
  
  console.log(`🔗 Client connected: ${clientId}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      await handleMessage(clientId, data, ws);
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    console.log(`🔌 Client disconnected: ${clientId}`);
    connections.delete(clientId);
    
    // Clean up any streams for this client
    for (const [streamId, stream] of activeStreams.entries()) {
      if (stream.clientId === clientId) {
        activeStreams.delete(streamId);
        console.log(`🗑️ Cleaned up stream: ${streamId}`);
      }
    }
  });

  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'connected', 
    clientId,
    message: 'Connected to Oracle Stream Server'
  }));
});

async function handleMessage(clientId, data, ws) {
  const { type, payload } = data;

  switch (type) {
    case 'start-stream':
      await startStream(clientId, payload, ws);
      break;
    
    case 'stop-stream':
      await stopStream(clientId, payload, ws);
      break;
    
    case 'update-filters':
      await updateFilters(clientId, payload, ws);
      break;
    
    case 'video-frame':
      await processVideoFrame(clientId, payload, ws);
      break;
    
    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
  }
}

async function startStream(clientId, payload, ws) {
  const { userId, roomId, streamId } = payload;
  
  console.log(`🎥 Starting stream: ${streamId} for user: ${userId}`);
  
  const stream = {
    id: streamId,
    userId,
    roomId,
    clientId,
    startTime: new Date(),
    filters: {},
    processor: null
  };
  
  activeStreams.set(streamId, stream);
  
  ws.send(JSON.stringify({
    type: 'stream-started',
    streamId,
    message: 'Stream processing started'
  }));
}

async function stopStream(clientId, payload, ws) {
  const { streamId } = payload;
  
  if (activeStreams.has(streamId)) {
    const stream = activeStreams.get(streamId);
    
    // Stop any running processors
    if (stream.processor) {
      stream.processor.kill();
    }
    
    activeStreams.delete(streamId);
    console.log(`🛑 Stopped stream: ${streamId}`);
    
    ws.send(JSON.stringify({
      type: 'stream-stopped',
      streamId,
      message: 'Stream processing stopped'
    }));
  }
}

async function updateFilters(clientId, payload, ws) {
  const { streamId, filters } = payload;
  
  if (activeStreams.has(streamId)) {
    const stream = activeStreams.get(streamId);
    stream.filters = { ...stream.filters, ...filters };
    
    console.log(`🎨 Updated filters for stream: ${streamId}`, filters);
    
    ws.send(JSON.stringify({
      type: 'filters-updated',
      streamId,
      filters: stream.filters
    }));
  }
}

async function processVideoFrame(clientId, payload, ws) {
  const { streamId, frameData, timestamp } = payload;
  
  if (!activeStreams.has(streamId)) {
    return;
  }
  
  const stream = activeStreams.get(streamId);
  
  try {
    // Process frame with Python AI pipeline
    const processedFrame = await processFrameWithAI(frameData, stream.filters);
    
    // Send processed frame back
    ws.send(JSON.stringify({
      type: 'processed-frame',
      streamId,
      frameData: processedFrame,
      timestamp
    }));
    
    // Broadcast to other clients in the same room
    broadcastToRoom(stream.roomId, {
      type: 'remote-frame',
      streamId,
      userId: stream.userId,
      frameData: processedFrame,
      timestamp
    }, clientId);
    
  } catch (error) {
    console.error('Error processing frame:', error);
    ws.send(JSON.stringify({
      type: 'processing-error',
      streamId,
      error: error.message
    }));
  }
}

async function processFrameWithAI(frameData, filters) {
  return new Promise((resolve, reject) => {
    // Spawn Python process for AI processing
    const python = spawn('python3', ['process_frame.py'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result.processedFrame);
        } catch (e) {
          reject(new Error('Failed to parse Python output'));
        }
      } else {
        reject(new Error(`Python process failed: ${error}`));
      }
    });
    
    // Send input data to Python process
    python.stdin.write(JSON.stringify({ frameData, filters }));
    python.stdin.end();
  });
}

function broadcastToRoom(roomId, message, excludeClientId) {
  for (const [clientId, ws] of connections.entries()) {
    if (clientId !== excludeClientId && ws.readyState === WebSocket.OPEN) {
      // Check if this client has streams in the same room
      const hasRoomStream = Array.from(activeStreams.values())
        .some(stream => stream.roomId === roomId && stream.clientId === clientId);
      
      if (hasRoomStream) {
        ws.send(JSON.stringify(message));
      }
    }
  }
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Oracle Stream Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
EOF

# Create Python AI processing script
print_status "Creating AI processing pipeline..."
cat > process_frame.py << 'EOF'
#!/usr/bin/env python3
import sys
import json
import base64
import cv2
import numpy as np
import mediapipe as mp
from io import BytesIO

# Initialize MediaPipe
mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh
mp_selfie_segmentation = mp.solutions.selfie_segmentation
mp_drawing = mp.solutions.drawing_utils

class AIFrameProcessor:
    def __init__(self):
        self.face_detection = mp_face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5)
        self.face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, min_detection_confidence=0.5)
        self.selfie_segmentation = mp_selfie_segmentation.SelfieSegmentation(model_selection=1)
    
    def process_frame(self, frame_data, filters):
        try:
            # Decode base64 frame
            frame_bytes = base64.b64decode(frame_data.split(',')[1])
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                raise ValueError("Could not decode frame")
            
            # Convert BGR to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Apply filters based on settings
            processed_frame = self.apply_filters(rgb_frame, filters)
            
            # Convert back to BGR for encoding
            bgr_frame = cv2.cvtColor(processed_frame, cv2.COLOR_RGB2BGR)
            
            # Encode back to base64
            _, buffer = cv2.imencode('.jpg', bgr_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            encoded_frame = base64.b64encode(buffer).decode('utf-8')
            
            return f"data:image/jpeg;base64,{encoded_frame}"
            
        except Exception as e:
            raise Exception(f"Frame processing error: {str(e)}")
    
    def apply_filters(self, frame, filters):
        processed = frame.copy()
        
        # Background removal and replacement
        if filters.get('backgroundRemoval', False):
            processed = self.remove_background(processed, filters.get('backgroundReplacement', 'blur'))
        
        # Face enhancement
        if filters.get('faceEnhancement', False):
            processed = self.enhance_face(processed, filters)
        
        # Color adjustments
        processed = self.adjust_colors(processed, filters)
        
        # Special effects
        processed = self.apply_effects(processed, filters)
        
        return processed
    
    def remove_background(self, frame, replacement_type):
        # Use MediaPipe for segmentation
        results = self.selfie_segmentation.process(frame)
        
        if results.segmentation_mask is not None:
            # Create mask
            mask = results.segmentation_mask > 0.5
            mask_3d = np.stack([mask] * 3, axis=-1)
            
            if replacement_type == 'blur':
                # Blur background
                blurred = cv2.GaussianBlur(frame, (21, 21), 0)
                frame = np.where(mask_3d, frame, blurred)
            elif replacement_type == 'gradient':
                # Create gradient background
                h, w = frame.shape[:2]
                gradient = np.linspace(0, 255, h).reshape(h, 1, 1)
                gradient = np.repeat(gradient, w, axis=1)
                gradient = np.repeat(gradient, 3, axis=2).astype(np.uint8)
                frame = np.where(mask_3d, frame, gradient)
            else:
                # Default: make background transparent (black for now)
                frame = np.where(mask_3d, frame, 0)
        
        return frame
    
    def enhance_face(self, frame, filters):
        # Detect faces
        results = self.face_detection.process(frame)
        
        if results.detections:
            for detection in results.detections:
                # Get face bounding box
                bbox = detection.location_data.relative_bounding_box
                h, w, _ = frame.shape
                
                x = int(bbox.xmin * w)
                y = int(bbox.ymin * h)
                width = int(bbox.width * w)
                height = int(bbox.height * h)
                
                # Extract face region
                face_region = frame[y:y+height, x:x+width]
                
                # Apply skin smoothing
                smoothing = filters.get('skinSmoothing', 0) / 100.0
                if smoothing > 0:
                    face_region = self.smooth_skin(face_region, smoothing)
                
                # Apply eye brightening
                eye_brightness = filters.get('eyeBrightening', 0) / 100.0
                if eye_brightness > 0:
                    face_region = self.brighten_eyes(face_region, eye_brightness)
                
                # Put face back
                frame[y:y+height, x:x+width] = face_region
        
        return frame
    
    def smooth_skin(self, face, intensity):
        # Simple bilateral filter for skin smoothing
        kernel_size = int(15 * intensity)
        if kernel_size % 2 == 0:
            kernel_size += 1
        
        smoothed = cv2.bilateralFilter(face, kernel_size, 80, 80)
        return cv2.addWeighted(face, 1 - intensity, smoothed, intensity, 0)
    
    def brighten_eyes(self, face, intensity):
        # Simple brightness adjustment for eye region (top 1/3 of face)
        h = face.shape[0]
        eye_region = face[:h//3, :]
        brightened = cv2.convertScaleAbs(eye_region, alpha=1 + intensity * 0.3, beta=intensity * 20)
        face[:h//3, :] = brightened
        return face
    
    def adjust_colors(self, frame, filters):
        # Brightness
        brightness = filters.get('brightness', 0)
        if brightness != 0:
            frame = cv2.convertScaleAbs(frame, alpha=1, beta=brightness * 2.55)
        
        # Contrast
        contrast = filters.get('contrast', 0)
        if contrast != 0:
            alpha = 1 + (contrast / 50.0)
            frame = cv2.convertScaleAbs(frame, alpha=alpha, beta=0)
        
        # Saturation
        saturation = filters.get('saturation', 0)
        if saturation != 0:
            hsv = cv2.cvtColor(frame, cv2.COLOR_RGB2HSV)
            hsv[:, :, 1] = cv2.multiply(hsv[:, :, 1], 1 + saturation / 100.0)
            frame = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
        
        return frame
    
    def apply_effects(self, frame, filters):
        # Vintage effect
        if filters.get('vintage', False):
            # Apply sepia tone
            kernel = np.array([[0.272, 0.534, 0.131],
                              [0.349, 0.686, 0.168],
                              [0.393, 0.769, 0.189]])
            frame = cv2.transform(frame, kernel)
            frame = np.clip(frame, 0, 255).astype(np.uint8)
        
        # Color filters
        color_filter = filters.get('colorFilter', 'none')
        if color_filter == 'warm':
            frame[:, :, 0] = np.clip(frame[:, :, 0] * 1.1, 0, 255)  # More red
            frame[:, :, 2] = np.clip(frame[:, :, 2] * 0.9, 0, 255)  # Less blue
        elif color_filter == 'cool':
            frame[:, :, 0] = np.clip(frame[:, :, 0] * 0.9, 0, 255)  # Less red
            frame[:, :, 2] = np.clip(frame[:, :, 2] * 1.1, 0, 255)  # More blue
        elif color_filter == 'bw':
            gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
            frame = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
        
        return frame

def main():
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        frame_data = data['frameData']
        filters = data['filters']
        
        # Process frame
        processor = AIFrameProcessor()
        processed_frame = processor.process_frame(frame_data, filters)
        
        # Output result
        result = {
            'success': True,
            'processedFrame': processed_frame
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    main()
EOF

# Make Python script executable
chmod +x process_frame.py

# Configure firewall
print_status "Configuring firewall..."
sudo ufw allow 8080/tcp comment "Stream Server"
sudo ufw allow 8080/udp comment "Stream Server"

# Enable firewall if not already enabled
sudo ufw --force enable

# Create systemd service
print_status "Creating systemd service..."
sudo tee /etc/systemd/system/oracle-stream-server.service > /dev/null << EOF
[Unit]
Description=Oracle Stream Processing Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/stream-server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
print_status "Starting stream server service..."
sudo systemctl daemon-reload
sudo systemctl enable oracle-stream-server
sudo systemctl start oracle-stream-server

# Check status
sleep 2
if sudo systemctl is-active --quiet oracle-stream-server; then
    print_status "✅ Stream server started successfully!"
else
    print_error "❌ Failed to start stream server"
    sudo journalctl -u oracle-stream-server --no-pager -l
    exit 1
fi

# Test the server
print_status "Testing stream server..."
if curl -s http://localhost:8080/health > /dev/null; then
    print_status "✅ Health check passed!"
else
    print_warning "⚠️ Health check failed"
fi

# Display configuration for your app
echo
echo "🎉 Setup complete! Add these environment variables to your Vercel project:"
echo "=================================================="
echo "NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL=ws://$PUBLIC_IP:8080"
echo "=================================================="
echo
echo "📊 Useful commands:"
echo "sudo systemctl status oracle-stream-server    # Check status"
echo "sudo journalctl -u oracle-stream-server -f    # View logs"
echo "sudo systemctl restart oracle-stream-server   # Restart service"
echo "curl http://$PUBLIC_IP:8080/health           # Test health"
echo
echo "🔗 Test your stream server at: http://$PUBLIC_IP:8080/health"
echo
echo "🎥 Your Oracle Cloud VM is now ready for AI-powered video processing!"
