import test from 'ava';

import { Client } from '../../../client';
import { createLdapSchool, deleteLdapSchool } from '../school';

import {
	addMemberToLdapGroup,
	deleteLdapGroup,
	LdapGroup,
	syncLdapGroups,
	upsertLdapGroup,
} from './group';

const client = Client.getInstance('hidden');

test.before(async () => {
	await client.setup(
		{
			url: 'ldap://localhost:389',
		},
		'uid=churros,ou=services',
		'ldapdev',
		'dc=inpt,dc=fr'
	);
	await client.connect();
	await createLdapSchool('inp'); // Create a school for testing
});

test.serial('A group can be upserted', async (t) => {
	await upsertLdapGroup({
		name: 'inp-net-inp',
		gidNumber: 1001,
		school: 'inp',
	});

	const { searchEntries: createdGroup } = await client.search(
		'ou=groups,o=inp,ou=schools',
		{
			filter: '(objectClass=posixGroup)',
		}
	);

	t.is(createdGroup.length, 1, 'No group was created');
	t.like(
		createdGroup[0],
		{
			cn: 'inp-net-inp',
			gidNumber: '1001',
			memberUid: undefined,
		},
		'The group was not created with the correct attributes'
	);

	await upsertLdapGroup({
		name: 'inp-net-inp',
		gidNumber: 1001,
		school: 'inp',
		members: ['versairea', 'dreumonte'],
	});

	const { searchEntries: updatedGroup } = await client.search(
		'ou=groups,o=inp,ou=schools',
		{
			filter: '(objectClass=posixGroup)',
		}
	);

	t.is(updatedGroup.length, 1, 'Another group was created or deleted');
	t.like(
		updatedGroup[0],
		{
			cn: 'inp-net-inp',
			gidNumber: '1001',
			memberUid: ['versairea', 'dreumonte'],
		},
		'The group was not created with the correct attributes'
	);

	await upsertLdapGroup({
		name: 'inp-net-inp',
		gidNumber: 1001,
		school: 'inp',
		members: [],
	});

	const { searchEntries: updatedTwiceGroup } = await client.search(
		'ou=groups,o=inp,ou=schools',
		{
			filter: '(objectClass=posixGroup)',
		}
	);

	t.is(updatedTwiceGroup.length, 1, 'Another group was created or deleted');
	t.like(
		updatedTwiceGroup[0],
		{
			cn: 'inp-net-inp',
			gidNumber: '1001',
			memberUid: undefined,
		},
		'The group was not updated with the correct attributes'
	);
});

test.serial('A member can be added to a group', async (t) => {
	await addMemberToLdapGroup('astleyr', 'inp-net-inp', 'inp');

	const { searchEntries: group } = await client.search(
		'ou=groups,o=inp,ou=schools',
		{
			filter: '(objectClass=posixGroup)',
		}
	);

	t.is(group[0].memberUid, 'astleyr', 'Member was not added to the group');
});

test.serial('A group can be deleted', async (t) => {
	await deleteLdapGroup('inp-net-inp', 'inp');

	const { searchEntries } = await client.search(
		'ou=groups,o=inp,ou=schools',
		{
			filter: '(objectClass=posixGroup)',
		}
	);

	t.is(searchEntries.length, 0, 'Group was not deleted');
});

test.serial('LdapGroups can be synced with a list of groups', async (t) => {
	const groups: LdapGroup[] = [
		{
			name: 'inp-net-inp',
			gidNumber: 1001,
			school: 'inp',
			members: ['astleyr'],
		},
		{
			name: 'inp-net-inp2',
			gidNumber: 1002,
			school: 'inp',
			members: ['astleyr'],
		},
	];

	for (const group of groups) {
		await upsertLdapGroup(group);
	}

	groups.push({
		name: 'inp-net-inp3',
		gidNumber: 1003,
		school: 'inp',
		members: ['astleyr'],
	});
	groups.shift();
	groups[0].members = ['astleyr', 'dreumonte'];

	await syncLdapGroups(groups);

	const { searchEntries } = await client.search(
		'ou=groups,o=inp,ou=schools',
		{
			filter: '(objectClass=posixGroup)',
		}
	);

	t.is(searchEntries.length, 2, 'Groups were not synced correctly');

	for (const group of groups) {
		let members: string[] | string =
			group.members?.length && group.members ? group.members : [];
		members = members.length > 1 ? members : members[0];

		t.like(
			searchEntries.find((entry) => entry.cn === group.name),
			{
				cn: group.name,
				gidNumber: group.gidNumber.toString(),
				memberUid: members,
			},
			'Groups were not synced correctly'
		);
	}
});

test.after(async () => {
	await deleteLdapSchool('inp'); // Delete the school created for testing
	const client = Client.getInstance();
	await client.disconnect();
});
