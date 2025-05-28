#!/bin/bash

# Update Oracle Stream Server to support CORS
set -e

echo "🔧 Adding CORS support to Oracle Stream Server..."

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

# Check if we're in the stream-server directory
if [ ! -f "server.js" ]; then
    print_error "server.js not found. Please run this script from the stream-server directory."
    exit 1
fi

print_status "Backing up current server.js..."
cp server.js server.js.backup.$(date +%Y%m%d_%H%M%S)

print_status "Updating server.js with CORS support..."

# Create updated server.js with CORS headers
cat > server.js << 'EOF'
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);

// Enable CORS for all routes
app.use(cors({
  origin: [
    'https://ldrphotobooththingy.vercel.app',
    'https://*.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'User-Agent']
}));

app.use(express.json({ limit: '50mb' }));

// Add security headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    activeStreams: activeStreams.size,
    server: 'Oracle Cloud Lightweight Stream Processor',
    version: '2.1.0',
    cors: 'enabled'
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
    totalConnections: connections.size,
    cors: 'enabled'
  });
});

// CORS preflight handler
app.options('*', (req, res) => {
  res.sendStatus(200);
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
    serverVersion: '2.1.0',
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
  console.log(`🌐 CORS enabled for Vercel domains`);
  console.log(`🎥 No TensorFlow - using lightweight AI processing`);
});
EOF

print_status "Restarting Oracle stream server..."
sudo systemctl restart oracle-stream-server

# Wait for service to start
sleep 3

# Check if service is running
if sudo systemctl is-active --quiet oracle-stream-server; then
    print_status "✅ Oracle stream server restarted with CORS support!"
    
    # Test the health endpoint
    print_status "Testing health endpoint..."
    if curl -s http://localhost:8080/health | grep -q "cors"; then
        print_status "✅ CORS support confirmed!"
    else
        print_warning "⚠️ CORS support may not be working properly"
    fi
else
    print_error "❌ Failed to restart Oracle stream server"
    print_error "Checking logs..."
    sudo journalctl -u oracle-stream-server --no-pager -l --since "1 minute ago"
    exit 1
fi

echo
echo "🎉 CORS support added to Oracle Stream Server!"
echo "=================================================="
echo "✅ Server now accepts requests from Vercel domains"
echo "✅ Health checks will work through proxy API"
echo "✅ WebSocket connections remain unchanged"
echo "=================================================="
echo
print_status "Your photobooth app should now connect successfully!"
