import test from 'ava';

import { Client } from '../../client';
import { LdapUser } from '../../types/user';

import {
	deleteLdapUser,
	getLdapUser,
	hashPassword,
	upsertLdapUser,
} from './user';

const client = Client.getInstance('hidden');

/**
 * Test user
 */
const user: LdapUser = {
	uid: 'versairea',
	firstName: 'Annie',
	lastName: 'Versaire',
	givenName: 'Anniversaire',
	password: hashPassword('hello_world'),
	email: ['hello@ldap7.net'],
	sshKeys: [
		'ssh-ed25519 placeholderkey 53308142+LeGmask@users.noreply.github.com',
	],
};

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

test.serial('An user can be created', async (t) => {
	await upsertLdapUser(user);

	const { searchEntries } = await client.search(`ou=people`, {
		filter: `uid=${user.uid}`,
	});

	t.is(searchEntries.length, 1, 'No user was created');

	const insertedUser = searchEntries[0];

	t.like(
		insertedUser,
		{
			uid: user.uid,
			cn: user.firstName + ' ' + user.lastName,
			sn: user.lastName,
			givenName: user.givenName,
			displayName: user.firstName + ' ' + user.lastName,
			initials: user.firstName[0] + user.lastName[0],
			mail: user.email[0],
			userPassword: user.password,
			gecos: user.firstName + ' ' + user.lastName,
			gidNumber: '1000',
			homeDirectory: '/tmp',
			loginShell: '/bin/none',
		},
		'User does not match the expected values'
	);
});

test.serial('An user can be retrieved', async (t) => {
	const retrievedUser = await getLdapUser(user.uid);

	t.assert(retrievedUser, 'User was not found');
	t.like(
		retrievedUser,
		{
			uid: user.uid,
			cn: user.firstName + ' ' + user.lastName,
			sn: user.lastName,
			givenName: user.givenName,
			displayName: user.firstName + ' ' + user.lastName,
			initials: user.firstName[0] + user.lastName[0],
			mail: user.email[0],
			gecos: user.firstName + ' ' + user.lastName,
			gidNumber: '1000',
			homeDirectory: '/tmp',
			loginShell: '/bin/none',
		},
		'User does not match the expected values'
	);
});

test.serial('An user can be updated', async (t) => {
	const updatedUser = user;
	updatedUser.school = 'n7';
	updatedUser.email.push('toaster@test.com');

	await upsertLdapUser(updatedUser);

	const { searchEntries } = await client.search(`ou=people`, {
		filter: `uid=${updatedUser.uid}`,
	});

	t.is(searchEntries.length, 1, 'User is gone ?!');

	const insertedUser = searchEntries[0];

	t.like(
		insertedUser,
		{
			uid: updatedUser.uid,
			cn: updatedUser.firstName + ' ' + updatedUser.lastName,
			sn: updatedUser.lastName,
			givenName: updatedUser.givenName,
			displayName: updatedUser.firstName + ' ' + updatedUser.lastName,
			initials: updatedUser.firstName[0] + updatedUser.lastName[0],
			mail: updatedUser.email,
			userPassword: updatedUser.password,
			gecos: updatedUser.firstName + ' ' + updatedUser.lastName,
			gidNumber: '1000',
			homeDirectory: '/home/' + updatedUser.uid,
			loginShell: '/bin/bash',
			ou: 'n7',
			sshPublicKey: updatedUser.sshKeys?.at(0),
		},
		'User does not match the expected values'
	);
});

test.serial('An user can be deleted', async (t) => {
	await deleteLdapUser(user.uid);

	const { searchEntries } = await client.search(`ou=people`, {
		filter: `uid=${user.uid}`,
	});

	t.is(searchEntries.length, 0, 'User was not deleted');
});

test.after(async () => {
	const client = Client.getInstance();
	await client.disconnect();
});
