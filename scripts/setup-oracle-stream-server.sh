#!/bin/bash

# Oracle Cloud Stream Server Setup Script (Lightweight - No TensorFlow)
set -e

echo "🚀 Setting up Lightweight Stream Processing Server on Oracle Cloud..."

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

# Install Python and lightweight AI dependencies (NO TENSORFLOW)
print_status "Installing Python and lightweight AI processing dependencies..."
sudo apt install -y python3 python3-pip python3-venv
sudo apt install -y libopencv-dev python3-opencv
sudo apt install -y ffmpeg

# Install lightweight Python libraries only
print_status "Installing lightweight AI processing libraries..."
pip3 install --user opencv-python mediapipe numpy pillow websockets

print_status "✅ Skipping TensorFlow installation (using lightweight alternatives)"

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
  "description": "Lightweight AI-powered video stream processing server",
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
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    activeStreams: activeStreams.size,
    server: 'Oracle Cloud Lightweight Stream Processor',
    version: '2.0.0'
  });
});

// Stream info endpoint
app.get('/streams', (req, res) => {
  const streams = Array.from(activeStreams.entries()).map(([id, stream]) => ({
    id,
    userId: stream.userId,
    startTime: stream.startTime,
    filters: stream.filters,
    frameCount: stream.frameCount || 0
  }));
  res.json({ streams, total: streams.length });
});

// Server stats endpoint
app.get('/stats', (req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  
  res.json({
    uptime: Math.floor(uptime),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
    },
    activeStreams: activeStreams.size,
    totalConnections: connections.size
  });
});

// WebSocket server for real-time communication
const wss = new WebSocket.Server({ 
  server,
  maxPayload: 50 * 1024 * 1024 // 50MB max payload
});

// Store active streams and connections
const activeStreams = new Map();
const connections = new Map();

wss.on('connection', (ws, req) => {
  const clientId = generateId();
  const clientIP = req.socket.remoteAddress;
  connections.set(clientId, { ws, ip: clientIP, connectedAt: new Date() });
  
  console.log(`🔗 Client connected: ${clientId} from ${clientIP}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      await handleMessage(clientId, data, ws);
    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('close', () => {
    console.log(`🔌 Client disconnected: ${clientId}`);
    connections.delete(clientId);
    
    // Clean up any streams for this client
    for (const [streamId, stream] of activeStreams.entries()) {
      if (stream.clientId === clientId) {
        if (stream.processor) {
          stream.processor.kill();
        }
        activeStreams.delete(streamId);
        console.log(`🗑️ Cleaned up stream: ${streamId}`);
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });

  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'connected', 
    clientId,
    message: 'Connected to Oracle Lightweight Stream Server',
    serverVersion: '2.0.0',
    timestamp: new Date().toISOString()
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
    
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;
    
    default:
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: `Unknown message type: ${type}`,
        timestamp: new Date().toISOString()
      }));
  }
}

async function startStream(clientId, payload, ws) {
  const { userId, roomId, streamId } = payload;
  
  console.log(`🎥 Starting stream: ${streamId} for user: ${userId} in room: ${roomId}`);
  
  const stream = {
    id: streamId,
    userId,
    roomId,
    clientId,
    startTime: new Date(),
    filters: {},
    processor: null,
    frameCount: 0
  };
  
  activeStreams.set(streamId, stream);
  
  ws.send(JSON.stringify({
    type: 'stream-started',
    streamId,
    message: 'Lightweight stream processing started',
    timestamp: new Date().toISOString()
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
    
    const frameCount = stream.frameCount || 0;
    activeStreams.delete(streamId);
    console.log(`🛑 Stopped stream: ${streamId} (processed ${frameCount} frames)`);
    
    ws.send(JSON.stringify({
      type: 'stream-stopped',
      streamId,
      frameCount,
      message: 'Stream processing stopped',
      timestamp: new Date().toISOString()
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
      filters: stream.filters,
      timestamp: new Date().toISOString()
    }));
  }
}

async function processVideoFrame(clientId, payload, ws) {
  const { streamId, frameData, timestamp } = payload;
  
  if (!activeStreams.has(streamId)) {
    return;
  }
  
  const stream = activeStreams.get(streamId);
  stream.frameCount = (stream.frameCount || 0) + 1;
  
  try {
    // Process frame with lightweight Python AI pipeline
    const processedFrame = await processFrameWithLightweightAI(frameData, stream.filters);
    
    // Send processed frame back
    ws.send(JSON.stringify({
      type: 'processed-frame',
      streamId,
      frameData: processedFrame,
      timestamp,
      frameNumber: stream.frameCount
    }));
    
    // Broadcast to other clients in the same room
    broadcastToRoom(stream.roomId, {
      type: 'remote-frame',
      streamId,
      userId: stream.userId,
      frameData: processedFrame,
      timestamp,
      frameNumber: stream.frameCount
    }, clientId);
    
  } catch (error) {
    console.error(`Error processing frame for stream ${streamId}:`, error);
    ws.send(JSON.stringify({
      type: 'processing-error',
      streamId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
  }
}

async function processFrameWithLightweightAI(frameData, filters) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Frame processing timeout'));
    }, 10000); // 10 second timeout
    
    // Spawn Python process for lightweight AI processing
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
      clearTimeout(timeout);
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          if (result.success) {
            resolve(result.processedFrame);
          } else {
            reject(new Error(result.error || 'Processing failed'));
          }
        } catch (e) {
          reject(new Error('Failed to parse Python output'));
        }
      } else {
        reject(new Error(`Python process failed with code ${code}: ${error}`));
      }
    });
    
    python.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
    
    // Send input data to Python process
    try {
      python.stdin.write(JSON.stringify({ frameData, filters }));
      python.stdin.end();
    } catch (err) {
      clearTimeout(timeout);
      reject(new Error(`Failed to write to Python process: ${err.message}`));
    }
  });
}

function broadcastToRoom(roomId, message, excludeClientId) {
  let broadcastCount = 0;
  
  for (const [clientId, connection] of connections.entries()) {
    if (clientId !== excludeClientId && connection.ws.readyState === WebSocket.OPEN) {
      // Check if this client has streams in the same room
      const hasRoomStream = Array.from(activeStreams.values())
        .some(stream => stream.roomId === roomId && stream.clientId === clientId);
      
      if (hasRoomStream) {
        connection.ws.send(JSON.stringify(message));
        broadcastCount++;
      }
    }
  }
  
  if (broadcastCount > 0) {
    console.log(`📡 Broadcasted to ${broadcastCount} clients in room: ${roomId}`);
  }
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Oracle Lightweight Stream Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Stats: http://localhost:${PORT}/stats`);
  console.log(`🎥 No TensorFlow - using lightweight AI processing`);
});
EOF

# Copy the lightweight Python processing script
print_status "Creating lightweight AI processing pipeline..."
cp ../process_frame_lightweight.py process_frame.py || {
    print_warning "Could not copy process_frame_lightweight.py, creating basic version..."
    cat > process_frame.py << 'EOF'
#!/usr/bin/env python3
import sys
import json
import base64
import cv2
import numpy as np

def process_frame_basic(frame_data, filters):
    try:
        # Decode base64 frame
        if ',' in frame_data:
            frame_bytes = base64.b64decode(frame_data.split(',')[1])
        else:
            frame_bytes = base64.b64decode(frame_data)
        
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise ValueError("Could not decode frame")
        
        # Apply basic filters
        processed = frame.copy()
        
        # Brightness
        brightness = filters.get('brightness', 0)
        if brightness != 0:
            processed = cv2.convertScaleAbs(processed, alpha=1, beta=brightness * 2)
        
        # Blur
        blur_amount = filters.get('blur', 0)
        if blur_amount > 0:
            kernel_size = max(3, blur_amount * 2 + 1)
            if kernel_size % 2 == 0:
                kernel_size += 1
            processed = cv2.GaussianBlur(processed, (kernel_size, kernel_size), 0)
        
        # Encode back to base64
        _, buffer = cv2.imencode('.jpg', processed, [cv2.IMWRITE_JPEG_QUALITY, 75])
        encoded_frame = base64.b64encode(buffer).decode('utf-8')
        
        return f"data:image/jpeg;base64,{encoded_frame}"
        
    except Exception as e:
        raise Exception(f"Frame processing error: {str(e)}")

def main():
    try:
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        frame_data = data['frameData']
        filters = data['filters']
        
        processed_frame = process_frame_basic(frame_data, filters)
        
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
}

# Make Python script executable
chmod +x process_frame.py

# Test Python dependencies
print_status "Testing Python dependencies..."
python3 -c "import cv2, numpy; print('✅ Basic dependencies working')" || {
    print_error "Python dependencies not working properly"
    exit 1
}

# Configure firewall
print_status "Configuring firewall rules..."
sudo ufw allow 8080/tcp comment "Stream Server HTTP/WebSocket"
sudo ufw allow 22/tcp comment "SSH"

# Enable firewall if not already enabled
if ! sudo ufw status | grep -q "Status: active"; then
    print_status "Enabling firewall..."
    sudo ufw --force enable
else
    print_status "Firewall already enabled"
fi

# Show firewall status
sudo ufw status

# Create systemd service
print_status "Creating systemd service for auto-start..."
sudo tee /etc/systemd/system/oracle-stream-server.service > /dev/null << EOF
[Unit]
Description=Oracle Lightweight Stream Processing Server
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$HOME/stream-server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8080
StandardOutput=journal
StandardError=journal
SyslogIdentifier=oracle-stream-server

# Resource limits for Always Free tier
LimitNOFILE=65536
MemoryMax=1G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
print_status "Enabling systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable oracle-stream-server

# Start the service
print_status "Starting stream server service..."
sudo systemctl start oracle-stream-server

# Wait a moment for service to start
sleep 3

# Check service status
if sudo systemctl is-active --quiet oracle-stream-server; then
    print_status "✅ Stream server started successfully!"
    
    # Show service status
    sudo systemctl status oracle-stream-server --no-pager -l
else
    print_error "❌ Failed to start stream server"
    print_error "Checking logs..."
    sudo journalctl -u oracle-stream-server --no-pager -l --since "1 minute ago"
    exit 1
fi

# Test the server
print_status "Testing stream server..."
sleep 2

if curl -s http://localhost:8080/health > /dev/null; then
    print_status "✅ Health check passed!"
    
    # Show health response
    echo "Health check response:"
    curl -s http://localhost:8080/health | python3 -m json.tool
else
    print_warning "⚠️ Health check failed - server might still be starting"
fi

# Display final configuration
echo
echo "🎉 Setup complete! Your Oracle Cloud VM is ready!"
echo "=================================================="
echo "📊 Service Management Commands:"
echo "sudo systemctl status oracle-stream-server     # Check status"
echo "sudo systemctl restart oracle-stream-server    # Restart service"
echo "sudo systemctl stop oracle-stream-server       # Stop service"
echo "sudo journalctl -u oracle-stream-server -f     # View live logs"
echo
echo "🔗 Server Endpoints:"
echo "http://$PUBLIC_IP:8080/health                  # Health check"
echo "http://$PUBLIC_IP:8080/stats                   # Server statistics"
echo "http://$PUBLIC_IP:8080/streams                 # Active streams"
echo "ws://$PUBLIC_IP:8080                           # WebSocket connection"
echo
echo "🌍 Add this environment variable to your Vercel project:"
echo "NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL=ws://$PUBLIC_IP:8080"
echo "=================================================="
echo
echo "🎥 Your lightweight AI-powered video processing server is ready!"
echo "💡 No TensorFlow = No crashes on Always Free tier!"
echo
print_status "🚀 Server is running and will auto-start on boot!"
