#!/bin/bash -ex

# Remove old configuration
rm -rf /var/lib/ldap/* || true

# Generate slapd.conf
/etc/ldap/utils/update-conf.sh

# Import templates
/etc/ldap/utils/bootstrap.sh


# Start slapd
/usr/sbin/slapd -d3 -s trace -f /etc/ldap/slapd.conf
