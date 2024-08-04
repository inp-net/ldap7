import { Entry, ResultCodeError } from 'ldapts';

import { Client } from '../../client.js';
import { getLogger } from '../utils.js';

/**
 * Create a new school in LDAP if it does not exist
 * This function will not throw an error if the school already exists in
 * order to use synchronization scripts.
 *
 * @param uid
 */
async function createLdapSchool(uid: string): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'School');

	logger.debug(`Checking if school ${uid} exists`);
	const searchEntries: Entry[] = [];

	try {
		const { searchEntries: entries } = await client.search(
			`o=${uid},ou=schools,${base_dn}`,
		);
		searchEntries.push(...entries);
	} catch (error) {
		const ldapError = error as ResultCodeError;

		// 32 is the error code for "no such object"
		if (ldapError.code !== 32) {
			throw error;
		}
	}

	if (searchEntries.length > 1) {
		logger.debug(`School ${uid} already exists`);
		return;
	}

	logger.debug(`School ${uid} does not exist, creating`);
	await client.add(`o=${uid},ou=schools,${base_dn}`, {
		objectClass: ['organization'],
		o: uid,
	});
	await createSchoolLayout(uid);
	logger.debug(`School ${uid} created`);
}

/**
 * Create the base layout for a school in LDAP
 * @param uid
 */
async function createSchoolLayout(uid: string): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'School');
	logger.debug(`Creating layout for school ${uid}`);

	logger.debug(`Creating ou=groups in school ${uid}`);
	await client.add(`ou=groups,o=${uid},ou=schools,${base_dn}`, {
		objectClass: ['organizationalUnit'],
		ou: 'groups',
	});

	logger.debug(`School ${uid} layout created`);
}

/**
 * Cleanup a school in LDAP
 * @param uid
 */
async function cleanupSchool(uid: string): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'School');
	logger.debug(`Cleaning up school ${uid}`);

	logger.debug(`Deleting groups in school ${uid}`);
	const { searchEntries } = await client.search(
		`ou=groups,o=${uid},ou=schools,${base_dn}`,
		{
			filter: '(objectClass=posixGroup)',
		},
	);
	for (const entry of searchEntries) {
		await client.del(entry.dn);
	}
	logger.debug(`Deleting ou=groups in school ${uid}`);
	await client.del(`ou=groups,o=${uid},ou=schools,${base_dn}`);

	logger.debug(`School ${uid} cleaned up`);
}

/**
 * Delete a school in LDAP
 * @param uid
 */
async function deleteLdapSchool(uid: string): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'School');

	await cleanupSchool(uid);

	logger.debug(`Trying to delete school ${uid}`);
	await client.del(`o=${uid},ou=schools,${base_dn}`);
	logger.debug(`School ${uid} deleted`);
}

/**
 * Sync a list of schools with the LDAP server
 *
 * @param uids
 */
async function syncLdapSchools(uids: string[]): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'School');

	logger.info(`Syncing schools`);

	for (const uid of uids) {
		try {
			await createLdapSchool(uid);
		} catch (error) {
			logger.error(`Error syncing school ${uid}`, error);
		}
	}

	const { searchEntries } = await client.search(`ou=schools,${base_dn}`, {
		filter: 'o=*',
	});

	const orphanSchools = searchEntries.filter(
		(entry) => !uids.find((uid) => uid === entry.o),
	);

	for (const orphanSchool of orphanSchools) {
		logger.debug(`Removing orphan school ${orphanSchool.o}`);
		try {
			await deleteLdapSchool(orphanSchool.o as string);
		} catch (error) {
			logger.error(`Error deleting school ${orphanSchool.o}`, error);
		}
	}

	logger.info(`${uids.length} Schools synced`);
}

export { createLdapSchool, deleteLdapSchool, syncLdapSchools };
