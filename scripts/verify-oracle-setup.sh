#!/bin/bash

# Oracle Cloud Coturn Verification Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Get server IP
if [ -z "$1" ]; then
    read -p "Enter your Oracle VM Public IP: " SERVER_IP
else
    SERVER_IP=$1
fi

print_header "Oracle Cloud Coturn Server Verification"
echo "Testing server: $SERVER_IP"
echo

# Test 1: Basic connectivity
print_header "1. Basic Connectivity Test"
if ping -c 3 $SERVER_IP > /dev/null 2>&1; then
    print_success "Server is reachable"
else
    print_error "Server is not reachable"
    exit 1
fi

# Test 2: SSH connectivity (optional)
print_header "2. SSH Connectivity Test"
if timeout 5 bash -c "</dev/tcp/$SERVER_IP/22" 2>/dev/null; then
    print_success "SSH port (22) is open"
else
    print_warning "SSH port (22) is not accessible (this is okay if you're not using SSH)"
fi

# Test 3: STUN/TURN ports
print_header "3. Port Accessibility Test"

# Test STUN port
if timeout 5 bash -c "</dev/tcp/$SERVER_IP/3478" 2>/dev/null; then
    print_success "STUN/TURN port (3478) is open"
else
    print_error "STUN/TURN port (3478) is not accessible"
fi

# Test TURN TLS port
if timeout 5 bash -c "</dev/tcp/$SERVER_IP/5349" 2>/dev/null; then
    print_success "TURN TLS port (5349) is open"
else
    print_warning "TURN TLS port (5349) is not accessible"
fi

# Test 4: STUN functionality (requires stun-client)
print_header "4. STUN Functionality Test"
if command -v stun &> /dev/null; then
    if stun $SERVER_IP 2>/dev/null | grep -q "Mapped Address"; then
        print_success "STUN server is responding correctly"
    else
        print_warning "STUN server is not responding as expected"
    fi
else
    print_info "stun-client not installed. Install with: sudo apt install stun-client"
fi

# Test 5: Coturn service status (if we can SSH)
print_header "5. Service Status Check"
print_info "To check Coturn service status on your Oracle VM, run:"
echo "  sudo systemctl status coturn"
echo "  sudo journalctl -u coturn --no-pager -l"

# Test 6: Oracle Cloud Security List verification
print_header "6. Oracle Cloud Security List Verification"
print_info "Ensure these ports are open in your Oracle Cloud Security Lists:"
echo "  • 3478 (UDP/TCP) - STUN/TURN"
echo "  • 5349 (UDP/TCP) - TURN over TLS"
echo "  • 49152-65535 (UDP) - TURN relay ports"
echo
print_info "To check/configure:"
echo "  1. Go to Oracle Cloud Console"
echo "  2. Navigate to Networking > Virtual Cloud Networks"
echo "  3. Select your VCN > Security Lists > Default Security List"
echo "  4. Verify Ingress Rules include the ports above"

# Test 7: Ubuntu firewall verification
print_header "7. Ubuntu Firewall Verification"
print_info "On your Oracle VM, verify UFW rules with:"
echo "  sudo ufw status"
echo
print_info "Expected output should include:"
echo "  3478/tcp                   ALLOW       Anywhere"
echo "  3478/udp                   ALLOW       Anywhere"
echo "  5349/tcp                   ALLOW       Anywhere"
echo "  5349/udp                   ALLOW       Anywhere"
echo "  49152:65535/udp            ALLOW       Anywhere"

# Test 8: Environment variables check
print_header "8. Environment Variables for Your App"
echo "Add these to your Vercel project:"
echo "NEXT_PUBLIC_TURN_SERVER_URL=turn:$SERVER_IP:3478"
echo "NEXT_PUBLIC_TURN_SERVER_USERNAME=webrtc"
echo "NEXT_PUBLIC_TURN_SERVER_CREDENTIAL=your-secret-key"
echo

# Test 9: WebRTC test recommendation
print_header "9. WebRTC Functionality Test"
print_info "Test your TURN server with WebRTC:"
echo "  1. Visit: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/"
echo "  2. Add TURN server: $SERVER_IP:3478"
echo "  3. Username: webrtc"
echo "  4. Password: your-secret-key"
echo "  5. Click 'Add Server' then 'Gather candidates'"
echo "  6. Look for 'relay' type candidates"

print_header "Verification Complete"
print_info "If all tests pass, your Oracle Cloud TURN server should work with your photobooth app!"
