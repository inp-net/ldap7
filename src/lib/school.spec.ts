import test from 'ava';
import { ResultCodeError } from 'ldapts';

import Client from './client';
import { createLdapSchool, deleteLdapSchool } from './school';

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
});

test.serial('A school can be created', async (t) => {
	await createLdapSchool('n7');

	const { searchEntries } = await client.search('o=n7');

	t.is(searchEntries.length, 1, 'No school was created');
	t.is(
		searchEntries[0].o,
		'n7',
		'The school was not created with the correct uid'
	);
});

test.serial('A school can be created only once', async (t) => {
	await createLdapSchool('n7');

	const { searchEntries } = await client.search('o=n7');

	t.is(searchEntries.length, 1, 'School was created multiple times');
});

test.serial('A school can be deleted', async (t) => {
	await deleteLdapSchool('n7');

	const error = (await t.throwsAsync(
		async () => {
			await client.search(`o=n7`);
		},
		{ instanceOf: Error }
	)) as ResultCodeError;

	t.is(error.code, 32, 'The school was not deleted');
});

test.after(async () => {
	const client = Client.getInstance();
	await client.disconnect();
});
