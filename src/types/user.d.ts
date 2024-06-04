export type LdapUser = {
	/**
	 * Unique identifier
	 */
	uid: string;

	/**
	 * First name
	 */
	firstName: string;

	/**
	 * Last name
	 */
	lastName: string;

	/**
	 * Given name
	 */
	givenName: string;

	/**
	 * Email addresses
	 */
	email: string[];

	/**
	 * Password hash (SHA-512) (see crypt(3) for details
	 * or use hashPassword function)
	 */
	password?: string;

	/**
	 * Buffer
	 */
	picture?: Buffer[];

	/**
	 * School uid
	 */
	school?: string[] | string;

	/**
	 * SSH public keys
	 */
	sshKeys?: string[];
};
