#!/bin/bash -ex

# Remove old configuration
rm -rf /etc/ldap/slapd.d/* || true

# Import templates
slapadd -v -n 1 -l /templates/ldap.ldif

/usr/sbin/slapd -d3 -s trace -f /etc/ldap/slapd.conf
