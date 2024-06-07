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
			`o=${uid},${base_dn}`
		);
		searchEntries.push(...entries);
	} catch (error) {
		const ldapError = error as ResultCodeError;

		// 32 is the error code for "no such object"
		if (ldapError.code !== 32) {
			throw error;
		}
	}

	if (searchEntries.length === 0) {
		logger.info(`School ${uid} does not exist, creating`);
		await client.add(`o=${uid},${base_dn}`, {
			objectClass: ['organization'],
			o: uid,
		});
		await createSchoolLayout(uid);
		logger.info(`School ${uid} created`);
	}

	logger.info(`School ${uid} already exists`);
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
	await client.add(`ou=groups,o=${uid},${base_dn}`, {
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
		`ou=groups,o=${uid},${base_dn}`,
		{
			filter: '(objectClass=posixGroup)',
		}
	);
	for (const entry of searchEntries) {
		await client.del(entry.dn);
	}
	logger.info(`Deleting ou=groups in school ${uid}`);
	await client.del(`ou=groups,o=${uid},${base_dn}`);

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
	await client.del(`o=${uid},${base_dn}`);
	logger.info(`School ${uid} deleted`);
}

export { createLdapSchool, deleteLdapSchool };
