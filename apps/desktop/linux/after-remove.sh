#!/bin/sh
# Fabric's .deb post-remove (0.3.5, CO-238): the PATH link after-install.sh made.
set -e
rm -f /usr/bin/passioncode-fabric
