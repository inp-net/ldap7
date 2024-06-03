#!/bin/bash -ex

/usr/sbin/slapd -d3 -s trace -h "ldap://0.0.0.0:389/ ldapi://%2Fvar%2Frun%2Fslapd%2Fldapi ldaps://0.0.0.0:636/" -f /etc/ldap/slapd.conf
