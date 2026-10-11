#!/bin/sh
# Fabric's .deb post-install (0.3.5, CO-238). The packaged folder keeps the packager's 0700 otherwise (platforms.md,
# lessons); the command goes on PATH; Chromium's sandbox helper must be root-owned and setuid to start at all.
set -e
APP=/opt/Fabric
chmod 755 "$APP"
ln -sf "$APP/passioncode-fabric" /usr/bin/passioncode-fabric
if [ -f "$APP/chrome-sandbox" ]; then chown root:root "$APP/chrome-sandbox"; chmod 4755 "$APP/chrome-sandbox"; fi
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database -q /usr/share/applications || true; fi
