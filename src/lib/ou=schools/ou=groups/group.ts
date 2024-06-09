import { Attribute, Change, Entry, ResultCodeError } from 'ldapts';

import { Client } from '../../../client';
import { LdapGroup } from '../../../types/group';
import { getLogger } from '../../utils';

/**
 * Create or update a group in LDAP
 * @param group
 */
async function upsertLdapGroup(group: LdapGroup) {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'Group');
	const searchEntries: Entry[] = [];

	try {
		const { searchEntries: entries } = await client.search(
			`cn=${group.name},ou=groups,o=${group.school},ou=schools,${base_dn}`
		);
		searchEntries.push(...entries);
	} catch (error) {
		const ldapError = error as ResultCodeError;

		// 32 is the error code for "no such object"
		if (ldapError.code !== 32) {
			throw error;
		}
	}

	if (searchEntries.length > 0) {
		logger.info(`Group ${group.name} already exists, updating`);

		await client.modify(
			`cn=${group.name},ou=groups,o=${group.school},ou=schools,${base_dn}`,
			[
				new Change({
					operation: 'replace',
					modification: new Attribute({
						type: 'memberUid',
						values: group.members,
					}),
				}),
			]
		);
	} else {
		logger.info(`Creating group ${group.name}`);

		const ldapGroup = [
			new Attribute({
				type: 'objectClass',
				values: ['posixGroup'],
			}),
			new Attribute({
				type: 'cn',
				values: [group.name],
			}),
			new Attribute({
				type: 'gidNumber',
				values: [group.gidNumber.toString()],
			}),
		];

		if (group.members && group.members.length > 0)
			ldapGroup.push(
				new Attribute({
					type: 'memberUid',
					values: group.members,
				})
			);

		await client.add(
			`cn=${group.name},ou=groups,o=${group.school},ou=schools,${base_dn}`,
			ldapGroup
		);
	}
}

/**
 * Add a user to a group in LDAP
 */
async function addMemberToLdapGroup(
	uid: string,
	group: string,
	school: string
) {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'Group');

	logger.info(`Adding user ${uid} to group ${group}`);
	await client.modify(
		`cn=${group},ou=groups,o=${school},ou=schools,${base_dn}`,
		[
			new Change({
				operation: 'add',
				modification: new Attribute({
					type: 'memberUid',
					values: [uid],
				}),
			}),
		]
	);
}

/**
 * Delete a group in LDAP
 *
 * @param cn
 * @param school
 */
async function deleteLdapGroup(cn: string, school: string) {
	const { client, logger: parentLogger, base_dn } = Client.getClient();
	const logger = getLogger(parentLogger, 'Group');

	logger.info(`Deleting group ${cn}`);
	await client.del(`cn=${cn},ou=groups,o=${school},ou=schools,${base_dn}`);
}

export { LdapGroup, upsertLdapGroup, addMemberToLdapGroup, deleteLdapGroup };
