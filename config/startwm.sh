#!/bin/sh
# =============================================================================
#  THADD OS — xrdp session launcher (RDP logins land here)
# =============================================================================
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XDG_SESSION_TYPE=x11

if [ -x /opt/thadd/session.sh ]; then
    exec /opt/thadd/session.sh
fi
exec startxfce4
