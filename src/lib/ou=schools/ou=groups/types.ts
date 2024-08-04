export type LdapGroup = {
	/**
	 * The name of the group (UID)
	 */
	name: string;

	/**
	 * The school the group belongs to
	 */
	school: string;

	/**
	 * The GID number of the group, starting from 1
	 * Will be offset by 1000 in LDAP (unix)
	 */
	gidNumber: number;

	/**
	 * Members of the group
	 */
	members?: string[];
};
