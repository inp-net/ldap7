import { Entry, ResultCodeError } from 'ldapts';

import Client from './client';
import { getLogger } from './utils';

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
		logger.info(`School ${uid} created`);
	}

	logger.info(`School ${uid} already exists`);
}

async function deleteLdapSchool(uid: string): Promise<void> {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'School');

	logger.info(`Trying to delete school ${uid}`);
	await client.del(`o=${uid},${base_dn}`);
	logger.info(`School ${uid} deleted`);
}

export { createLdapSchool, deleteLdapSchool };
