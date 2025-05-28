#!/bin/bash

# Fix Coturn Authentication Issues
set -e

echo "🔧 Fixing Coturn authentication configuration..."

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

# Get current configuration
print_status "Checking current Coturn configuration..."

if [ ! -f /etc/turnserver.conf ]; then
    print_error "Coturn configuration file not found. Please run the setup script first."
    exit 1
fi

# Get server IP
PUBLIC_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo "UNKNOWN")
if [ "$PUBLIC_IP" = "UNKNOWN" ]; then
    read -p "Enter your Oracle VM Public IP: " PUBLIC_IP
fi

# Get secret key
read -s -p "Enter your TURN secret key: " SECRET_KEY
echo

if [ -z "$SECRET_KEY" ]; then
    print_error "Secret key is required"
    exit 1
fi

# Backup current configuration
print_status "Backing up current configuration..."
sudo cp /etc/turnserver.conf /etc/turnserver.conf.backup.$(date +%Y%m%d_%H%M%S)

# Create optimized configuration for WebRTC
print_status "Creating optimized Coturn configuration for WebRTC..."
sudo tee /etc/turnserver.conf > /dev/null << EOF
# Oracle Cloud Coturn Configuration - Optimized for WebRTC
listening-port=3478
tls-listening-port=5349

# Server configuration
external-ip=$PUBLIC_IP
listening-ip=0.0.0.0

# Relay ports
min-port=49152
max-port=65535

# Authentication - Static secret for WebRTC compatibility
use-auth-secret
static-auth-secret=$SECRET_KEY

# Realm - use server IP for better compatibility
realm=$PUBLIC_IP

# WebRTC compatibility settings
no-auth-pings
no-multicast-peers
no-loopback-peers
no-stdout-log

# Security settings
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=224.0.0.0-239.255.255.255
denied-peer-ip=240.0.0.0-255.255.255.255

# Process settings
proc-user=turnserver
proc-group=turnserver

# Logging
log-file=/var/log/turnserver.log
verbose

# Additional WebRTC optimizations
fingerprint
stale-nonce=600
max-bps=64000
bps-capacity=0
stun-only=false
no-cli
no-tls
no-dtls
lt-cred-mech
EOF

# Restart Coturn
print_status "Restarting Coturn service..."
sudo systemctl restart coturn

# Wait for service to start
sleep 3

# Check if service is running
if sudo systemctl is-active --quiet coturn; then
    print_status "✅ Coturn restarted successfully!"
else
    print_error "❌ Failed to restart Coturn"
    print_status "Checking logs..."
    sudo journalctl -u coturn --no-pager -l
    exit 1
fi

# Test the configuration
print_status "Testing STUN functionality..."
if command -v turnutils_stunclient &> /dev/null; then
    if turnutils_stunclient $PUBLIC_IP 2>/dev/null; then
        print_status "✅ STUN test passed!"
    else
        print_warning "⚠️ STUN test failed (might be normal)"
    fi
else
    print_warning "turnutils_stunclient not found, skipping STUN test"
fi

# Display final configuration
echo
echo "🎉 Coturn authentication fixed! Use these environment variables:"
echo "=================================================="
echo "NEXT_PUBLIC_TURN_SERVER_URL=$PUBLIC_IP:3478"
echo "NEXT_PUBLIC_TURN_SERVER_USERNAME=webrtc"
echo "TURN_SERVER_SECRET=your-secret-key-here"
echo "=================================================="
echo
echo "⚠️  IMPORTANT SECURITY NOTE:"
echo "- NEXT_PUBLIC_TURN_SERVER_URL and NEXT_PUBLIC_TURN_SERVER_USERNAME are safe to expose"
echo "- TURN_SERVER_SECRET should be kept private (no NEXT_PUBLIC_ prefix)"
echo "- The app will generate time-limited credentials server-side for security"
echo
echo "📊 Monitor your TURN server:"
echo "sudo journalctl -u coturn -f"
echo
echo "🔍 Test your server at:"
echo "https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/"
echo "Server: $PUBLIC_IP:3478"
echo "Username: webrtc"
echo "Password: [use your secret key]"
