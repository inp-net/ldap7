import test from 'ava';

import Client from '../../client';
import { createLdapSchool, deleteLdapSchool } from '../school';

import {
	addMemberToLdapGroup,
	deleteLdapGroup,
	upsertLdapGroup,
} from './group';

const client = Client.getInstance('hidden');

test.before(async () => {
	await client.setup(
		{
			url: 'ldap://localhost:389',
		},
		'cn=Manager',
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
		'ou=groups,o=inp',
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
		'ou=groups,o=inp',
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
		'ou=groups,o=inp',
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

	const { searchEntries: group } = await client.search('ou=groups,o=inp', {
		filter: '(objectClass=posixGroup)',
	});

	t.is(group[0].memberUid, 'astleyr', 'Member was not added to the group');
});

test.serial('A group can be deleted', async (t) => {
	await deleteLdapGroup('inp-net-inp', 'inp');

	const { searchEntries } = await client.search('ou=groups,o=inp', {
		filter: '(objectClass=posixGroup)',
	});

	t.is(searchEntries.length, 0, 'Group was not deleted');
});

test.after(async () => {
	await deleteLdapSchool('inp'); // Delete the school created for testing
	const client = Client.getInstance();
	await client.disconnect();
});
