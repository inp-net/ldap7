#!/bin/bash -ex

# Reset ldap if LDAP_RESET is set or if the database is empty
if [ -z "$(ls -A /var/lib/ldap)" ] || [ -n "$LDAP_RESET" ]; then
	LDAP_RESET=1
fi

if [ -n "$LDAP_RESET" ]; then
	# Remove old configuration
	rm -rf /var/lib/ldap/* || true

	# Generate slapd.conf
	/etc/ldap/utils/update-conf.sh

	# Migrate
	cat > /etc/ldap/.ldapm << EOF
LDAP_CONF=/etc/ldap/slapd.conf
LDAP_DB=1
EOF
	/etc/ldap/ldapm

	# Create service account
	/etc/ldap/utils/create-service_account.sh <<EOF
churros
ldapdev
EOF
else
	# Migrate
	/etc/ldap/ldapm
fi


# Start slapd
/usr/sbin/slapd -d3 -s trace -f /etc/ldap/slapd.conf
