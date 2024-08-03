import { Entry, ResultCodeError } from 'ldapts';

import { Client } from '../../client';
import { getLogger } from '../utils';

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

	logger.info(`Checking if school ${uid} exists`);
	const searchEntries: Entry[] = [];

	try {
		const { searchEntries: entries } = await client.search(
			`o=${uid},ou=schools,${base_dn}`
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
		logger.info(`School ${uid} already exists`);
		return;
	}

	logger.info(`School ${uid} does not exist, creating`);
	await client.add(`o=${uid},ou=schools,${base_dn}`, {
		objectClass: ['organization'],
		o: uid,
	});
	await createSchoolLayout(uid);
	logger.info(`School ${uid} created`);
}

/**
 * Create the base layout for a school in LDAP
 * @param uid
 */
async function createSchoolLayout(uid: string): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'School');
	logger.info(`Creating layout for school ${uid}`);

	logger.info(`Creating ou=groups in school ${uid}`);
	await client.add(`ou=groups,o=${uid},ou=schools,${base_dn}`, {
		objectClass: ['organizationalUnit'],
		ou: 'groups',
	});

	logger.info(`School ${uid} layout created`);
}

/**
 * Cleanup a school in LDAP
 * @param uid
 */
async function cleanupSchool(uid: string): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'School');
	logger.info(`Cleaning up school ${uid}`);

	logger.info(`Deleting groups in school ${uid}`);
	const { searchEntries } = await client.search(
		`ou=groups,o=${uid},ou=schools,${base_dn}`,
		{
			filter: '(objectClass=posixGroup)',
		}
	);
	for (const entry of searchEntries) {
		await client.del(entry.dn);
	}
	logger.info(`Deleting ou=groups in school ${uid}`);
	await client.del(`ou=groups,o=${uid},ou=schools,${base_dn}`);

	logger.info(`School ${uid} cleaned up`);
}

/**
 * Delete a school in LDAP
 * @param uid
 */
async function deleteLdapSchool(uid: string): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'School');

	await cleanupSchool(uid);

	logger.info(`Trying to delete school ${uid}`);
	await client.del(`o=${uid},ou=schools,${base_dn}`);
	logger.info(`School ${uid} deleted`);
}

/**
 * Sync a list of schools with the LDAP server
 *
 * @param uids
 */
async function syncLdapSchools(uids: string[]): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'School');

	logger.info('Syncing schools');

	for (const uid of uids) {
		await createLdapSchool(uid);
	}

	const { searchEntries } = await client.search(`ou=schools,${base_dn}`, {
		filter: 'o=*',
	});

	const orphanSchools = searchEntries.filter(
		(entry) => !uids.find((uid) => uid === entry.o)
	);

	for (const orphanSchool of orphanSchools) {
		logger.info(`Removing orphan school ${orphanSchool.o}`);
		await deleteLdapSchool(orphanSchool.o as string);
	}

	logger.info('Schools synced');
}

export { createLdapSchool, deleteLdapSchool, syncLdapSchools };
