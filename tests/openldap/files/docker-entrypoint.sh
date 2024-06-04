#!/bin/bash -ex

# Remove old configuration
rm -rf /var/lib/ldap/* || true

# Import templates
slapadd -v -n 1 -l /templates/ldap.ldif -f /etc/ldap/slapd.conf

# Start slapd
/usr/sbin/slapd -d3 -s trace -f /etc/ldap/slapd.conf
