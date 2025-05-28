# Oracle Cloud Stream Server Setup Guide

## Overview

This guide will help you set up a powerful AI-powered video stream processing server on Oracle Cloud's Always Free tier. The server will handle real-time video processing, AI filters, background removal, and face enhancement.

## Oracle Cloud Always Free Resources

- **VM.Standard.A1.Flex (Arm-based)**: 4 cores, 24GB RAM
- **VM.Standard.E2.1.Micro (x86)**: 1 core, 1GB RAM
- **Always Free** - No time limits!

## Architecture Overview

\`\`\`
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │   Vercel App    │    │  Oracle Cloud   │
│                 │◄──►│                 │◄──►│   Stream Server │
│ Camera Input    │    │ Room Management │    │ AI Processing   │
│ Video Display   │    │ WebSocket Proxy │    │ Filter Pipeline │
└─────────────────┘    └─────────────────┘    └─────────────────┘
\`\`\`

## Step 1: Create Oracle Cloud VM

1. **Sign up for Oracle Cloud** (if you haven't already)
2. **Create a new VM instance:**
   - **Shape**: VM.Standard.A1.Flex (Arm-based - more resources)
   - **CPU**: 4 cores
   - **Memory**: 24 GB
   - **Image**: Ubuntu 22.04
   - **Assign a public IP**

## Step 2: Configure Security Rules

In Oracle Cloud Console:
1. Go to **Networking > Virtual Cloud Networks**
2. Select your VCN > **Security Lists** > **Default Security List**
3. Add **Ingress Rules**:
   - **Port 8080 (TCP)** - Stream Server HTTP/WebSocket
   - **Port 22 (TCP)** - SSH (if needed)

## Step 3: Install Stream Server

SSH into your VM and run the setup script:

\`\`\`bash
# Download and run the setup script
curl -sSL https://raw.githubusercontent.com/your-repo/oracle-stream-setup.sh | bash

# Or manually run the commands from the script
\`\`\`

The setup script will:
- Install Node.js, Python, and dependencies
- Install AI libraries (OpenCV, MediaPipe, TensorFlow)
- Create the stream processing server
- Set up systemd service for auto-start
- Configure firewall rules

## Step 4: Verify Installation

\`\`\`bash
# Check service status
sudo systemctl status oracle-stream-server

# Test health endpoint
curl http://localhost:8080/health

# View logs
sudo journalctl -u oracle-stream-server -f
\`\`\`

Expected health response:
\`\`\`json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "activeStreams": 0,
  "server": "Oracle Cloud Stream Processor"
}
\`\`\`

## Step 5: Configure Your Vercel App

Add this environment variable to your Vercel project:

\`\`\`
NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL=ws://YOUR_ORACLE_VM_IP:8080
\`\`\`

Example:
\`\`\`
NEXT_PUBLIC_ORACLE_STREAM_SERVER_URL=ws://168.138.103.248:8080
\`\`\`

## AI Processing Features

### 🎭 Background Processing
- **Real-time background removal** using MediaPipe
- **Background replacement** (blur, gradients, custom images)
- **Edge detection** for precise person segmentation

### 👤 Face Enhancement
- **Skin smoothing** with bilateral filtering
- **Eye brightening** with selective enhancement
- **Teeth whitening** with color space manipulation
- **Face detection** using MediaPipe Face Detection

### 🎨 Color & Effects
- **Brightness/Contrast** adjustments
- **Saturation** control
- **Color filters** (warm, cool, sepia, B&W)
- **Vintage effects** with sepia toning

### ⚡ Performance Optimizations
- **Multi-threaded processing** with Python multiprocessing
- **Frame buffering** for smooth playback
- **Adaptive quality** based on processing load
- **GPU acceleration** (if available)

## Server API Endpoints

### HTTP Endpoints
- `GET /health` - Server health check
- `GET /streams` - List active streams

### WebSocket Messages
- `start-stream` - Begin processing for a user
- `stop-stream` - Stop processing
- `update-filters` - Change filter settings
- `video-frame` - Send frame for processing

## Monitoring and Maintenance

### Check Server Status
\`\`\`bash
# Service status
sudo systemctl status oracle-stream-server

# Resource usage
htop

# Network connections
sudo netstat -tulpn | grep 8080

# Disk usage
df -h
\`\`\`

### View Logs
\`\`\`bash
# Real-time logs
sudo journalctl -u oracle-stream-server -f

# Recent logs
sudo journalctl -u oracle-stream-server --since "1 hour ago"

# Error logs only
sudo journalctl -u oracle-stream-server -p err
\`\`\`

### Restart Service
\`\`\`bash
sudo systemctl restart oracle-stream-server
\`\`\`

## Troubleshooting

### Common Issues

1. **Service won't start**
   \`\`\`bash
   # Check logs for errors
   sudo journalctl -u oracle-stream-server --no-pager -l
   
   # Check Python dependencies
   python3 -c "import cv2, mediapipe, numpy; print('All imports successful')"
   \`\`\`

2. **Connection refused**
   \`\`\`bash
   # Check if service is running
   sudo systemctl status oracle-stream-server
   
   # Check firewall
   sudo ufw status
   
   # Test local connection
   curl http://localhost:8080/health
   \`\`\`

3. **High CPU usage**
   \`\`\`bash
   # Monitor resource usage
   htop
   
   # Reduce processing quality in filters
   # Limit concurrent streams
   \`\`\`

4. **Memory issues**
   \`\`\`bash
   # Check memory usage
   free -h
   
   # Restart service to clear memory
   sudo systemctl restart oracle-stream-server
   \`\`\`

### Performance Tuning

1. **Optimize for your VM size**:
   \`\`\`javascript
   // In server.js, adjust these settings:
   const MAX_CONCURRENT_STREAMS = 4; // For 4-core VM
   const FRAME_QUALITY = 0.8; // Reduce for better performance
   \`\`\`

2. **Enable GPU acceleration** (if available):
   \`\`\`bash
   # Install CUDA (for NVIDIA GPUs)
   # Or OpenCL for other GPUs
   \`\`\`

## Security Considerations

1. **Firewall Configuration**:
   - Only open necessary ports (8080, 22)
   - Consider using a VPN for SSH access

2. **SSL/TLS** (for production):
   \`\`\`bash
   # Install Nginx as reverse proxy with SSL
   sudo apt install nginx certbot
   \`\`\`

3. **Rate Limiting**:
   - Implement connection limits per IP
   - Monitor for abuse

## Scaling and Optimization

### For Higher Load
1. **Use multiple VM instances** with load balancing
2. **Implement Redis** for session management
3. **Add CDN** for static assets
4. **Use WebRTC** for direct peer connections when possible

### Cost Optimization
- **Always Free tier** covers most use cases
- **Monitor usage** to stay within limits
- **Auto-shutdown** during low usage periods

## Next Steps

1. **Test the complete flow** from browser to Oracle server
2. **Customize AI filters** based on your needs
3. **Add more background options**
4. **Implement user authentication** if needed
5. **Set up monitoring** and alerts

Your Oracle Cloud stream server is now ready to handle AI-powered video processing for your photobooth application! 🚀

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review server logs: `sudo journalctl -u oracle-stream-server -f`
3. Test with the health endpoint: `curl http://your-ip:8080/health`
4. Verify Oracle Cloud security rules and firewall settings
