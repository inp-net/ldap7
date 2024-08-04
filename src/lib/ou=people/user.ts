import cryptoRandomString from 'crypto-random-string';
import latinize from 'latinize';
import { Attribute, Change, Entry } from 'ldapts';
import { sha512 } from 'sha512-crypt-ts';

import { Client } from '../../client.js';
import { getLogger, isArray } from '../utils.js';

import type { LdapUser } from './types.js';

/**
 * Find the next available UID number using a binary search
 *
 * @param min
 * @param max
 */
async function findNextUidNumber(
	min = 10000,
	max = 100000000,
): Promise<number> {
	if (max >= 100000001) {
		throw new Error('No available UIDs');
	}

	const { client, base_dn } = Client.getClient();

	const avg_uid = Math.floor((min + max) / 2);

	const { searchEntries } = await client.search(`ou=people,${base_dn}`, {
		filter: `uidNumber=${avg_uid}`,
	});

	if (min == max) {
		if (searchEntries.length > 0)
			throw new Error(
				'An error occurred while searching for the next available UID number',
			);
		return min;
	}

	if (searchEntries.length > 0) return findNextUidNumber(avg_uid + 1, max);

	return findNextUidNumber(min, avg_uid);
}

/**
 * Hash a password using SHA-512
 * Crypt(3) format is used
 *
 * @param password
 */
function hashPassword(password: string): string {
	return `{CRYPT}${sha512.crypt(
		password,
		cryptoRandomString({ length: 16 }),
	)}`;
}

/**
 * Upsert a user in the LDAP server
 *
 * If the user does not exist, it will be created. If no school is provided,
 * the user will be created with a home directory in /tmp and a shell set to
 * /bin/none. If a school is provided, the user will be created with a home
 * and /bin/bash shell. If the user already exists, it will be updated.
 * @param ldapUser
 */
async function upsertLdapUser(ldapUser: LdapUser): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'User');

	logger.debug(`Upserting user ${ldapUser.uid}`);

	const { searchEntries } = await client.search(`ou=people,${base_dn}`, {
		filter: `uid=${ldapUser.uid}`,
	});

	if (searchEntries.length > 1) {
		throw new Error('Multiple users found, this should not happen');
	}

	if (searchEntries.length > 0) {
		logger.debug(`User ${ldapUser.uid} already exists, updating`);

		const user = searchEntries[0];

		const changes = [
			new Change({
				operation: 'replace',
				modification: new Attribute({
					type: 'cn',
					values: [`${ldapUser.firstName} ${ldapUser.lastName}`],
				}),
			}),
			new Change({
				operation: 'replace',
				modification: new Attribute({
					type: 'sn',
					values: [ldapUser.lastName],
				}),
			}),
			new Change({
				operation: 'replace',
				modification: new Attribute({
					type: 'displayName',
					values: [`${ldapUser.firstName} ${ldapUser.lastName}`],
				}),
			}),
			new Change({
				operation: 'replace',
				modification: new Attribute({
					type: 'givenName',
					values: [ldapUser.firstName],
				}),
			}),
			new Change({
				operation: 'replace',
				modification: new Attribute({
					type: 'initials',
					values: [ldapUser.firstName[0] + ldapUser.lastName[0]],
				}),
			}),
			new Change({
				operation: 'replace',
				modification: new Attribute({
					type: 'mail',
					values: ldapUser.email,
				}),
			}),
			new Change({
				operation: 'replace',
				modification: new Attribute({
					type: 'gecos',
					values: [
						latinize(`${ldapUser.firstName} ${ldapUser.lastName}`),
					],
				}),
			}),
		];

		if (ldapUser.password) {
			changes.push(
				new Change({
					operation: 'replace',
					modification: new Attribute({
						type: 'userPassword',
						values: [ldapUser.password],
					}),
				}),
			);
		}

		if (
			ldapUser.school !== undefined &&
			(!isArray(ldapUser.school) || ldapUser.school.length > 0)
		) {
			changes.push(
				new Change({
					operation: 'replace',
					modification: new Attribute({
						type: 'organizationalUnitName',
						values: isArray(ldapUser.school)
							? ldapUser.school
							: [ldapUser.school],
					}),
				}),
			);

			if (
				user.homeDirectory === '/tmp' ||
				user.loginShell === '/bin/none'
			) {
				changes.push(
					new Change({
						operation: 'replace',
						modification: new Attribute({
							type: 'homeDirectory',
							values: [`/home/${ldapUser.uid}`],
						}),
					}),
				);

				changes.push(
					new Change({
						operation: 'replace',
						modification: new Attribute({
							type: 'loginShell',
							values: ['/bin/bash'],
						}),
					}),
				);
			}

			if (ldapUser.sshKeys !== undefined && ldapUser.sshKeys.length > 0)
				changes.push(
					new Change({
						operation: 'replace',
						modification: new Attribute({
							type: 'sshPublicKey',
							values: ldapUser.sshKeys,
						}),
					}),
				);
		}

		if (ldapUser.picture)
			changes.push(
				new Change({
					operation: 'replace',
					modification: new Attribute({
						type: 'jpegPhoto',
						values: ldapUser.picture,
					}),
				}),
			);

		await client.modify(
			`uid=${ldapUser.uid},ou=people,${base_dn}`,
			changes,
		);
	} else {
		logger.info(`User ${ldapUser.uid} does not exist, creating`);

		if (ldapUser.email.length === 0) {
			throw new Error('Email is required');
		}

		const newUser: Attribute[] = [
			new Attribute({
				type: 'objectClass',
				values: [
					'inetOrgPerson',
					'organizationalPerson',
					'posixAccount',
					'shadowAccount',
					'ldapPublicKey',
				],
			}),
			new Attribute({
				type: 'uid',
				values: [ldapUser.uid],
			}),
			new Attribute({
				type: 'cn',
				values: [`${ldapUser.firstName} ${ldapUser.lastName}`],
			}),
			new Attribute({
				type: 'sn',
				values: [ldapUser.lastName],
			}),
			new Attribute({
				type: 'givenName',
				values: [ldapUser.firstName],
			}),
			new Attribute({
				type: 'displayName',
				values: [`${ldapUser.firstName} ${ldapUser.lastName}`],
			}),
			new Attribute({
				type: 'initials',
				values: [ldapUser.firstName[0] + ldapUser.lastName[0]],
			}),
			new Attribute({
				type: 'mail',
				values: ldapUser.email,
			}),
			new Attribute({
				type: 'gecos',
				values: [
					latinize(`${ldapUser.firstName} ${ldapUser.lastName}`),
				],
			}),
			new Attribute({
				type: 'uidNumber',
				values: [String(await findNextUidNumber())],
			}),
			new Attribute({
				type: 'gidNumber',
				values: ['1000'],
			}),
			new Attribute({
				type: 'homeDirectory',
				values: ['/tmp'],
			}),
			new Attribute({
				type: 'loginShell',
				values: ['/bin/none'],
			}),
		];

		if (ldapUser.password)
			newUser.push(
				new Attribute({
					type: 'userPassword',
					values: [ldapUser.password],
				}),
			);

		// optional school
		if (
			ldapUser.school !== undefined &&
			(!isArray(ldapUser.school) || ldapUser.school.length > 0)
		) {
			// newUser.organizationalUnitName = ldapUser.school;
			newUser.push(
				new Attribute({
					type: 'organizationalUnitName',
					values: isArray(ldapUser.school)
						? ldapUser.school
						: [ldapUser.school],
				}),
			);

			// Since the user is now an "internal" user, we need to setup
			// correctly the home directory and the login shell
			newUser.filter((attr) => attr.type === 'homeDirectory')[0].values =
				[`/home/${ldapUser.uid}`];
			newUser.filter((attr) => attr.type === 'loginShell')[0].values = [
				'/bin/bash',
			];
		}

		// optional ssh keys
		if (ldapUser.sshKeys !== undefined && ldapUser.sshKeys.length > 0)
			newUser.push(
				new Attribute({
					type: 'sshPublicKey',
					values: ldapUser.sshKeys,
				}),
			);

		// optional picture
		if (ldapUser.picture)
			newUser.push(
				new Attribute({
					type: 'jpegPhoto',
					values: ldapUser.picture,
				}),
			);

		await client.add(`uid=${ldapUser.uid},ou=people,${base_dn}`, newUser);
	}

	logger.debug(`User ${ldapUser.uid} upserted`);
}

/**
 * Get a user from the LDAP server
 *
 * Currently, this function return only the ldap response, if needed a mapping
 * could be done to return a more user-friendly object.
 *
 * @param uid
 */
async function getLdapUser(uid: string): Promise<Entry | null> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'User');

	logger.debug(`Getting user ${uid}`);
	const { searchEntries } = await client.search(`ou=people,${base_dn}`, {
		filter: `uid=${uid}`,
	});

	if (searchEntries.length === 0) return null;

	const user = searchEntries[0];
	delete user.userPassword; // remove hashed password from the response

	return user;
}

/**
 * Delete a user from the LDAP server
 *
 * @param uid
 */
async function deleteLdapUser(uid: string): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'User');

	logger.debug(`Removing user ${uid}`);
	await client.del(`uid=${uid},ou=people,${base_dn}`);
	logger.debug(`User ${uid} removed`);
}

/**
 * Sync a list of LdapUser with the LDAP server
 *
 * @param ldapUsers
 */
async function syncLdapUsers(ldapUsers: LdapUser[]): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'User');

	logger.info(`Syncing users`);

	for (const ldapUser of ldapUsers) {
		// We always upsert the user, in order to keep the LDAP server in sync
		try {
			await upsertLdapUser(ldapUser);
		} catch (error) {
			logger.error(`Error syncing user ${ldapUser.uid}`, error);
		}
	}

	const { searchEntries } = await client.search(`ou=people,${base_dn}`, {
		filter: 'uid=*',
	});

	const orphanUsers = searchEntries.filter(
		(entry) => !ldapUsers.find((user) => user.uid === entry.uid),
	);

	for (const orphanUser of orphanUsers) {
		logger.debug(`Removing orphan user ${orphanUser.uid}`);
		try {
			await deleteLdapUser(orphanUser.uid as string);
		} catch (error) {
			logger.error(`Error removing orphan user ${orphanUser.uid}`, error);
		}
	}

	logger.info(`${ldapUsers.length} users synced`);
}

export {
	LdapUser,
	upsertLdapUser,
	getLdapUser,
	deleteLdapUser,
	syncLdapUsers,
	hashPassword,
};
