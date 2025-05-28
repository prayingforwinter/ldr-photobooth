# Coturn Troubleshooting Guide

## Common Authentication Issues

### 1. 401 Unauthorized Error

**Symptoms:**
\`\`\`
ERROR: check_stun_auth: Cannot find credentials of user <username>
session 000000000000000007: realm <168.138.103.248> user <username>: incoming packet message processed, error 401: Unauthorized
\`\`\`

**Causes:**
- Mismatched secret keys between Coturn config and environment variables
- Using time-limited credentials with static auth configuration
- Incorrect realm setting
- Missing WebRTC compatibility settings

**Solutions:**

#### Option 1: Use Static Authentication (Recommended)

1. **Update Coturn Configuration:**
\`\`\`bash
sudo nano /etc/turnserver.conf
\`\`\`

Add these lines:
\`\`\`
use-auth-secret
static-auth-secret=your-secret-key
realm=your-server-ip
no-auth-pings
\`\`\`

2. **Set Environment Variables:**
\`\`\`
NEXT_PUBLIC_TURN_SERVER_URL=your-server-ip:3478
NEXT_PUBLIC_TURN_SERVER_USERNAME=webrtc
NEXT_PUBLIC_TURN_SERVER_CREDENTIAL=your-secret-key
\`\`\`

3. **Restart Coturn:**
\`\`\`bash
sudo systemctl restart coturn
\`\`\`

#### Option 2: Use Time-Limited Credentials

1. **Update Coturn Configuration:**
\`\`\`bash
sudo nano /etc/turnserver.conf
\`\`\`

Add these lines:
\`\`\`
lt-cred-mech
use-auth-secret
static-auth-secret=your-secret-key
realm=your-server-ip
\`\`\`

2. **Generate Time-Limited Credentials (Server-Side):**
\`\`\`bash
SECRET="your-secret-key"
USERNAME="webrtc"
TIMESTAMP=$(date +%s)
TEMP_USERNAME="${TIMESTAMP}:${USERNAME}"
TEMP_PASSWORD=$(echo -n "$TEMP_USERNAME" | openssl dgst -sha1 -hmac "$SECRET" -binary | base64)
\`\`\`

### 2. Connection Timeout Issues

**Symptoms:**
- TURN test times out
- No ICE candidates generated
- WebRTC connection fails

**Solutions:**

1. **Check Firewall Rules:**
\`\`\`bash
sudo ufw status
\`\`\`

Required ports:
- 3478 (UDP/TCP) - STUN/TURN
- 5349 (UDP/TCP) - TURN over TLS
- 49152-65535 (UDP) - TURN relay ports

2. **Check Oracle Cloud Security Lists:**
- Navigate to Oracle Cloud Console
- Go to Networking > Virtual Cloud Networks
- Select your VCN > Security Lists
- Verify ingress rules for the required ports

3. **Test Port Connectivity:**
\`\`\`bash
# Test from another machine
telnet your-server-ip 3478
nc -u your-server-ip 3478
\`\`\`

### 3. Service Not Starting

**Symptoms:**
\`\`\`
Failed to start coturn.service
\`\`\`

**Solutions:**

1. **Check Configuration Syntax:**
\`\`\`bash
sudo turnserver -c /etc/turnserver.conf --check-config
\`\`\`

2. **Check Logs:**
\`\`\`bash
sudo journalctl -u coturn -f
\`\`\`

3. **Check File Permissions:**
\`\`\`bash
sudo chown turnserver:turnserver /var/log/turnserver.log
sudo chmod 644 /etc/turnserver.conf
\`\`\`

### 4. Performance Issues

**Symptoms:**
- High latency
- Connection drops
- Poor video quality

**Solutions:**

1. **Optimize Coturn Configuration:**
\`\`\`
max-bps=64000
bps-capacity=0
stale-nonce=600
\`\`\`

2. **Monitor Resource Usage:**
\`\`\`bash
htop
sudo netstat -tulpn | grep turnserver
\`\`\`

3. **Check Oracle Cloud VM Resources:**
- Ensure adequate CPU and memory
- Monitor network bandwidth usage

## Verification Commands

### Check Coturn Status
\`\`\`bash
sudo systemctl status coturn
sudo journalctl -u coturn --no-pager -l
\`\`\`

### Test STUN/TURN Functionality
\`\`\`bash
# STUN test
turnutils_stunclient your-server-ip

# TURN test
turnutils_uclient -t -T -s -v your-server-ip
\`\`\`

### Monitor Real-Time Logs
\`\`\`bash
sudo journalctl -u coturn -f
\`\`\`

### Check Configuration
\`\`\`bash
sudo cat /etc/turnserver.conf | grep -E "(static-auth-secret|realm|use-auth-secret)"
\`\`\`

## Success Indicators

When everything is working correctly, you should see:

1. **In Coturn Logs:**
\`\`\`
session 000000000000000008: realm <your-ip> user <webrtc>: incoming packet message processed, success
\`\`\`

2. **In WebRTC Test:**
- STUN candidates generated
- TURN relay candidates generated
- Connection established successfully

3. **In Browser Console:**
\`\`\`
✅ TURN server working - found relay candidate
🔗 Connection state: connected
\`\`\`

## Emergency Recovery

If you break your configuration:

1. **Restore from Backup:**
\`\`\`bash
sudo cp /etc/turnserver.conf.backup.* /etc/turnserver.conf
sudo systemctl restart coturn
\`\`\`

2. **Reset to Default:**
\`\`\`bash
sudo apt remove --purge coturn
sudo apt install coturn
# Run setup script again
\`\`\`

3. **Check Oracle Cloud Console:**
- Verify VM is running
- Check security list rules
- Restart VM if necessary

## Getting Help

If you're still having issues:

1. **Collect Debug Information:**
\`\`\`bash
sudo journalctl -u coturn --no-pager -l > coturn.log
sudo cat /etc/turnserver.conf > coturn.conf
\`\`\`

2. **Test with Public TURN Server:**
Use `turn.anyfirewall.com:443` as a fallback to verify your WebRTC code works

3. **Check WebRTC Internals:**
Visit `chrome://webrtc-internals/` in Chrome for detailed connection information
