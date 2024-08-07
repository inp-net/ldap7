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
	 * Email addresses
	 */
	email: string[];

	/**
	 * Password hash (SHA-512) (see crypt(3) for details
	 * or use hashPassword function)
	 */
	password?: string;

	/**
	 * School uid
	 */
	school?: string[] | string;

	/**
	 * SSH public keys
	 */
	sshKeys?: string[];
};
