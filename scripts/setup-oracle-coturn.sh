#!/bin/bash

# Oracle Cloud Coturn Setup Script
set -e

echo "🚀 Setting up Coturn on Oracle Cloud..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
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
read -p "Domain name (or press Enter to use IP): " DOMAIN
read -s -p "TURN secret key (create a strong password): " SECRET_KEY
echo

# Validate inputs
if [ -z "$PUBLIC_IP" ]; then
    print_error "Public IP is required"
    exit 1
fi

if [ -z "$DOMAIN" ]; then
    DOMAIN=$PUBLIC_IP
    print_warning "Using IP address as domain: $DOMAIN"
fi

if [ -z "$SECRET_KEY" ]; then
    print_error "Secret key is required"
    exit 1
fi

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Coturn
print_status "Installing Coturn..."
sudo apt install coturn coturn-utils -y

# Enable Coturn
print_status "Enabling Coturn service..."
sudo systemctl enable coturn

# Create configuration
print_status "Creating Coturn configuration..."
sudo tee /etc/turnserver.conf > /dev/null << EOF
# Oracle Cloud Coturn Configuration for WebRTC
listening-port=3478
tls-listening-port=5349

# Server IPs
external-ip=$PUBLIC_IP
listening-ip=0.0.0.0

# Relay ports
min-port=49152
max-port=65535

# Authentication - use static secret for WebRTC compatibility
use-auth-secret
static-auth-secret=$SECRET_KEY

# Realm (use IP for better compatibility)
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

# Logging for debugging
log-file=/var/log/turnserver.log
verbose

# Additional WebRTC settings
fingerprint
lt-cred-mech
EOF

# Configure firewall
print_status "Configuring firewall..."
sudo ufw allow 3478/udp comment "TURN STUN"
sudo ufw allow 3478/tcp comment "TURN STUN" 
sudo ufw allow 5349/udp comment "TURN TLS"
sudo ufw allow 5349/tcp comment "TURN TLS"
sudo ufw allow 49152:65535/udp comment "TURN relay ports"

# Enable firewall if not already enabled
sudo ufw --force enable

# Start Coturn
print_status "Starting Coturn server..."
sudo systemctl start coturn

# Check status
sleep 2
if sudo systemctl is-active --quiet coturn; then
    print_status "✅ Coturn started successfully!"
else
    print_error "❌ Failed to start Coturn"
    sudo journalctl -u coturn --no-pager -l
    exit 1
fi

# Test the server
print_status "Testing TURN server..."
echo "Testing STUN functionality..."
if turnutils_stunclient $PUBLIC_IP 2>/dev/null; then
    print_status "✅ STUN test passed!"
else
    print_warning "⚠️ STUN test failed (might be normal)"
fi

# Display configuration for your app
echo
echo "🎉 Setup complete! Add these environment variables to your Vercel project:"
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
echo "📊 Useful commands:"
echo "sudo systemctl status coturn     # Check status"
echo "sudo journalctl -u coturn -f     # View logs"
echo "sudo systemctl restart coturn    # Restart service"
echo
echo "🔗 Test your TURN server at: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/"
echo "Use: $PUBLIC_IP:3478 with username 'webrtc' and password '$SECRET_KEY'"
