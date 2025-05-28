# Secure Oracle TURN Server Deployment Guide

## Security Overview

Your photobooth application now uses a secure, production-ready TURN server setup with the following security features:

### 🔒 Security Features

1. **Server-Side Credential Generation**
   - TURN credentials are generated server-side using Node.js crypto
   - Secret key never exposed to client-side code
   - HMAC-SHA1 signed authentication

2. **Time-Limited Credentials**
   - Credentials expire after 1 hour
   - Fresh credentials generated for each session
   - Automatic renewal prevents unauthorized access

3. **Environment Variable Security**
   - `TURN_SERVER_SECRET` is private (server-side only)
   - Public variables are safe to expose
   - No sensitive data in client bundles

## Environment Variables

### ✅ Public Variables (Safe to Expose)
\`\`\`
NEXT_PUBLIC_TURN_SERVER_URL=your-oracle-ip:3478
NEXT_PUBLIC_TURN_SERVER_USERNAME=webrtc
\`\`\`

### 🔐 Private Variables (Server-Side Only)
\`\`\`
TURN_SERVER_SECRET=your-strong-secret-key
\`\`\`

## Deployment Checklist

### 1. Oracle Cloud VM Setup
- [ ] VM created with public IP
- [ ] Coturn installed and configured
- [ ] Firewall rules configured (ports 3478, 5349, 49152-65535)
- [ ] Oracle Cloud Security Lists updated
- [ ] Coturn service running and tested

### 2. Vercel Environment Variables
- [ ] `NEXT_PUBLIC_TURN_SERVER_URL` set to your Oracle VM IP
- [ ] `NEXT_PUBLIC_TURN_SERVER_USERNAME` set to "webrtc"
- [ ] `TURN_SERVER_SECRET` set to your strong secret key
- [ ] Variables deployed to production

### 3. Security Verification
- [ ] Credential generation API working (`/api/turn-credentials`)
- [ ] Time-limited credentials being generated
- [ ] TURN server accepting generated credentials
- [ ] No sensitive data in client-side code
- [ ] WebRTC connections working with secure credentials

## Testing Your Deployment

### 1. Test Credential Generation
\`\`\`bash
curl https://your-app.vercel.app/api/turn-credentials
\`\`\`

Expected response:
\`\`\`json
{
  "urls": ["turn:your-ip:3478", "turn:your-ip:5349"],
  "username": "1640995200:webrtc",
  "credential": "generated-hmac-credential",
  "ttl": 3600
}
\`\`\`

### 2. Test TURN Server
Use the built-in test components in your app:
- Navigate to your photobooth app
- Join a room to see diagnostics
- Check "TURN Server Test" component
- Verify "TURN Test" shows "Pass"

### 3. Test WebRTC Connection
- Open app in two different browsers/devices
- Create a room in one browser
- Join the same room in another browser
- Verify video connection establishes

## Monitoring and Maintenance

### Oracle VM Monitoring
\`\`\`bash
# Check Coturn status
sudo systemctl status coturn

# View real-time logs
sudo journalctl -u coturn -f

# Check resource usage
htop

# Test STUN/TURN locally
turnutils_stunclient your-ip
\`\`\`

### Application Monitoring
- Use the built-in diagnostic components
- Monitor credential generation in browser dev tools
- Check WebRTC connection states
- Review Vercel function logs for API errors

## Troubleshooting

### Common Issues

1. **401 Unauthorized in Coturn logs**
   - Check `TURN_SERVER_SECRET` matches Coturn config
   - Verify credential generation API is working
   - Ensure time synchronization between server and client

2. **Credential generation fails**
   - Check Vercel environment variables
   - Verify `TURN_SERVER_SECRET` is set correctly
   - Check API route logs in Vercel dashboard

3. **TURN test fails**
   - Verify Oracle Cloud Security Lists
   - Check VM firewall (ufw status)
   - Test port connectivity from external network

### Emergency Fallback
If your Oracle TURN server fails, the app automatically falls back to public TURN servers:
- `turn:turn.anyfirewall.com:443`
- Connection will still work but may have higher latency

## Cost Optimization

### Oracle Cloud Always Free Tier
- VM.Standard.A1.Flex (Arm-based): 4 cores, 24GB RAM
- Always free - no time limits
- Sufficient for hundreds of concurrent TURN sessions

### Vercel Usage
- API route calls for credential generation
- Minimal impact on Vercel limits
- Consider caching credentials client-side for 30-45 minutes

## Security Best Practices

1. **Rotate Secret Keys Regularly**
   - Update `TURN_SERVER_SECRET` monthly
   - Update Coturn configuration accordingly
   - Test after rotation

2. **Monitor Access Logs**
   - Review Coturn logs for unusual activity
   - Monitor Vercel function logs
   - Set up alerts for failed authentications

3. **Network Security**
   - Keep Oracle VM updated
   - Use strong SSH keys
   - Consider VPN access for management

4. **Backup Configuration**
   - Backup Coturn configuration
   - Document environment variables
   - Keep setup scripts updated

## Performance Optimization

### Coturn Configuration
\`\`\`
max-bps=64000
bps-capacity=0
stale-nonce=600
\`\`\`

### Client-Side Optimization
- Cache credentials for 45 minutes
- Implement connection retry logic
- Use connection quality monitoring

Your Oracle TURN server is now production-ready with enterprise-grade security! 🚀
