import test from 'ava';
import { ResultCodeError } from 'ldapts';

import { Client } from '../../client';

import { upsertLdapGroup } from './ou=groups/group';
import { createLdapSchool, deleteLdapSchool, syncLdapSchools } from './school';

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
});

test.serial('A school can be created', async (t) => {
	await createLdapSchool('n7');

	const { searchEntries } = await client.search('o=n7,ou=schools', {
		filter: '(objectClass=organization)',
	});

	t.is(searchEntries.length, 1, 'No school was created');
	t.is(
		searchEntries[0].o,
		'n7',
		'The school was not created with the correct uid'
	);

	// we also check the layout of the school
	const { searchEntries: groups } = await client.search(
		'ou=groups,o=n7,ou=schools'
	);
	t.is(groups.length, 1, 'No groups ou was created');
	t.is(
		groups[0].ou,
		'groups',
		'The groups ou was not created with the correct uid'
	);
});

test.serial('A school can be created only once', async (t) => {
	await createLdapSchool('n7');

	const { searchEntries } = await client.search('o=n7,ou=schools', {
		filter: '(objectClass=organization)',
	});

	t.is(searchEntries.length, 1, 'School was created multiple times');
});

test.serial('A school can be deleted', async (t) => {
	// create some groups in the school
	await upsertLdapGroup({
		name: 'net7-n7',
		gidNumber: 1001,
		school: 'n7',
	});
	await upsertLdapGroup({
		name: 'net8-n7',
		gidNumber: 1002,
		school: 'n7',
	});

	await deleteLdapSchool('n7');

	const error = (await t.throwsAsync(
		async () => {
			await client.search(`o=n7,ou=schools`);
		},
		{ instanceOf: Error }
	)) as ResultCodeError;

	t.is(error.code, 32, 'The school was not deleted');
});

test.serial('Schools can be synced', async (t) => {
	await createLdapSchool('n7');
	await createLdapSchool('n8');
	await createLdapSchool('n9');

	await syncLdapSchools(['n6', 'n7', 'n9', 'inp']);

	const { searchEntries } = await client.search('ou=schools', {
		filter: '(objectClass=organization)',
	});

	t.is(searchEntries.length, 4, 'The schools were not synced');

	const uids = searchEntries.map((entry) => entry.o);
	t.true(uids.includes('n6'), 'n6 was not synced');
	t.true(uids.includes('n7'), 'n7 was not synced');
	t.false(uids.includes('n8'), 'n8 was not deleted');
	t.true(uids.includes('n9'), 'n9 was not synced');

	await deleteLdapSchool('n6');
	await deleteLdapSchool('n7');
	await deleteLdapSchool('n9');
});

test.after(async () => {
	const client = Client.getInstance();
	await client.disconnect();
});
