# Let's Encrypt SSL/TLS Setup for Debian 12

This guide will walk you through setting up free SSL/TLS certificates from Let's Encrypt for `greenhouse.trotz.me` on Debian 12.

## Prerequisites

1. **Domain DNS Configuration**
   - Your domain `greenhouse.trotz.me` must point to your server's public IP address
   - Verify DNS resolution: `nslookup greenhouse.trotz.me` or `dig greenhouse.trotz.me`
   - Allow time for DNS propagation (can take up to 48 hours, usually much faster)

2. **Firewall Configuration**
   - Port 80 (HTTP) must be open for initial certificate validation
   - Port 443 (HTTPS) must be open for SSL traffic
   - If using UFW: `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`
   - If using iptables, ensure ports 80 and 443 are allowed

3. **Nginx Configuration**
   - Nginx should be installed and running
   - The HTTP server block for `greenhouse.trotz.me` should be active
   - The site should be accessible via HTTP before setting up SSL

## Installation Steps

### 1. Install Certbot and Nginx Plugin

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

This installs:
- `certbot`: The Let's Encrypt client
- `python3-certbot-nginx`: Plugin for automatic nginx configuration

### 2. Verify Nginx Configuration

Before obtaining the certificate, ensure your nginx configuration is correct:

```bash
sudo nginx -t
```

If there are any errors, fix them before proceeding.

### 3. Obtain SSL Certificate

Run certbot with the nginx plugin to automatically obtain and configure the certificate:

```bash
sudo certbot --nginx -d greenhouse.trotz.me
```

**What happens during this step:**
- Certbot will ask for your email address (for renewal notifications)
- You'll be asked to agree to Let's Encrypt Terms of Service
- You can choose whether to share your email with EFF (optional)
- Certbot will automatically:
  - Obtain the certificate
  - Update your nginx configuration
  - Set up automatic renewal

**If you want to obtain a certificate for multiple domains:**
```bash
sudo certbot --nginx -d greenhouse.trotz.me -d www.greenhouse.trotz.me
```

### 4. Verify Certificate Installation

After certbot completes, verify the certificate was installed correctly:

```bash
sudo certbot certificates
```

You should see your certificate listed with expiration date (90 days from issue).

### 5. Test HTTPS Access

Open your browser and navigate to:
```
https://greenhouse.trotz.me
```

You should see a secure connection (lock icon) and no certificate warnings.

### 6. Verify Auto-Renewal

Let's Encrypt certificates expire after 90 days. Certbot sets up automatic renewal, but verify it's working:

**Test the renewal process (dry run):**
```bash
sudo certbot renew --dry-run
```

**Check renewal timer:**
```bash
sudo systemctl status certbot.timer
```

The timer should be active and will automatically renew certificates before they expire.

## Manual Configuration (Alternative Method)

If you prefer to manually configure nginx instead of using certbot's automatic configuration:

### 1. Obtain Certificate Only (No Auto-Config)

```bash
sudo certbot certonly --nginx -d greenhouse.trotz.me
```

This obtains the certificate but doesn't modify your nginx configuration.

### 2. Update Nginx Configuration

Edit your nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/greenhouse.trotz.me
```

Uncomment and update the HTTPS server block with the certificate paths:
```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name greenhouse.trotz.me;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/greenhouse.trotz.me/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/greenhouse.trotz.me/privkey.pem;

    # ... rest of configuration
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name greenhouse.trotz.me;
    return 301 https://$server_name$request_uri;
}
```

### 3. Test and Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Certificate Renewal

### Automatic Renewal

Certbot sets up automatic renewal via a systemd timer. Certificates are renewed automatically when they have less than 30 days remaining.

**Check renewal status:**
```bash
sudo systemctl status certbot.timer
```

**View renewal logs:**
```bash
sudo journalctl -u certbot.service
```

### Manual Renewal

If you need to manually renew certificates:

```bash
sudo certbot renew
```

After renewal, reload nginx:
```bash
sudo systemctl reload nginx
```

### Force Renewal (Testing)

To force renewal even if not due:
```bash
sudo certbot renew --force-renewal
```

## SSL Configuration Best Practices

### Recommended SSL Settings

After certificate installation, you may want to enhance your SSL configuration. Add these to your HTTPS server block:

```nginx
# Modern SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/greenhouse.trotz.me/chain.pem;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

## Troubleshooting

### Certificate Not Obtained

**Error: "Failed to obtain certificate"**

- **Check DNS**: Ensure `greenhouse.trotz.me` resolves to your server's IP
  ```bash
  nslookup greenhouse.trotz.me
  ```
- **Check Port 80**: Ensure port 80 is accessible from the internet
  ```bash
  sudo netstat -tlnp | grep :80
  ```
- **Check Nginx**: Ensure nginx is running and the HTTP server block is active
  ```bash
  sudo systemctl status nginx
  sudo nginx -t
  ```
- **Check Firewall**: Ensure ports 80 and 443 are open
  ```bash
  sudo ufw status
  ```

### Certificate Renewal Fails

**Error: "Renewal failed"**

- Check nginx configuration: `sudo nginx -t`
- Verify domain still points to server: `nslookup greenhouse.trotz.me`
- Check certbot logs: `sudo journalctl -u certbot.service`
- Try manual renewal: `sudo certbot renew --dry-run`

### Mixed Content Warnings

If your site shows mixed content warnings (HTTP resources on HTTPS page):
- Ensure all API calls use HTTPS or relative URLs
- Check browser console for specific resources causing issues
- Update any hardcoded HTTP URLs in your application

### Certificate Expired

If your certificate expires:
1. Renew immediately: `sudo certbot renew`
2. Reload nginx: `sudo systemctl reload nginx`
3. Check auto-renewal timer: `sudo systemctl status certbot.timer`

### Port 80 Already in Use

If another service is using port 80:
```bash
sudo lsof -i :80
```
Stop the conflicting service or configure nginx to use a different port temporarily for certificate validation.

## Useful Commands

```bash
# List all certificates
sudo certbot certificates

# Revoke a certificate
sudo certbot revoke --cert-path /etc/letsencrypt/live/greenhouse.trotz.me/cert.pem

# Delete a certificate
sudo certbot delete --cert-name greenhouse.trotz.me

# View certificate details
sudo openssl x509 -in /etc/letsencrypt/live/greenhouse.trotz.me/cert.pem -text -noout

# Check certificate expiration
sudo certbot certificates | grep -A 2 greenhouse.trotz.me

# Test SSL configuration
openssl s_client -connect greenhouse.trotz.me:443 -servername greenhouse.trotz.me
```

## Security Checklist

- [ ] SSL certificate installed and working
- [ ] HTTP redirects to HTTPS
- [ ] Modern TLS protocols enabled (TLSv1.2, TLSv1.3)
- [ ] Strong cipher suites configured
- [ ] HSTS header enabled
- [ ] Auto-renewal configured and tested
- [ ] Firewall allows ports 80 and 443
- [ ] Regular monitoring of certificate expiration

## Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://eff-certbot.readthedocs.io/)
- [SSL Labs SSL Test](https://www.ssllabs.com/ssltest/) - Test your SSL configuration
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/) - Generate secure nginx SSL configs

## Notes

- Let's Encrypt certificates are valid for 90 days
- Renewal should happen automatically, but monitor the first renewal
- Rate limits: 50 certificates per registered domain per week
- Keep your email address updated for renewal notifications
- Certbot logs are available at `/var/log/letsencrypt/`


