import test from 'ava';
import latinize from 'latinize';

import { Client } from '../../client.js';

import type { LdapUser } from './types.js';
import {
	deleteLdapUser,
	getLdapUser,
	hashPassword,
	syncLdapUsers,
	upsertLdapUser,
} from './user.js';

const client = Client.getInstance('hidden');

/**
 * Test user
 */
const user: LdapUser = {
	uid: 'versairea',
	firstName: 'Annie',
	lastName: 'Versaire',
	password: hashPassword('hello_world'),
	email: ['hello@ldap7.net'],
	sshKeys: [
		'ssh-ed25519 placeholderkey 53308142+LeGmask@users.noreply.github.com',
	],
};

/**
 * Test users
 */
const users: LdapUser[] = [
	user,
	{
		uid: 'toaster',
		firstName: 'Toaster',
		lastName: 'Strudel',
		password: hashPassword('hello_world'),
		email: ['toast@toast.net'],
	},
	{
		uid: 'baguette',
		firstName: 'Baguette',
		lastName: 'Frenchie',
		password: hashPassword('hello_world'),
		email: ['baguette@france.fr'],
	},
];

test.before(async () => {
	await client.setup(
		{
			url: 'ldap://localhost:389',
		},
		'uid=churros,ou=services',
		'ldapdev',
		'dc=inpt,dc=fr',
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
			givenName: user.firstName,
			displayName: user.firstName + ' ' + user.lastName,
			initials: user.firstName[0] + user.lastName[0],
			mail: user.email[0],
			userPassword: user.password,
			gecos: latinize(user.firstName + ' ' + user.lastName),
			gidNumber: '1000',
			homeDirectory: '/tmp',
			loginShell: '/bin/none',
		},
		'User does not match the expected values',
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
			givenName: user.firstName,
			displayName: user.firstName + ' ' + user.lastName,
			initials: user.firstName[0] + user.lastName[0],
			mail: user.email[0],
			gecos: latinize(user.firstName + ' ' + user.lastName),
			gidNumber: '1000',
			homeDirectory: '/tmp',
			loginShell: '/bin/none',
		},
		'User does not match the expected values',
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
			givenName: updatedUser.firstName,
			displayName: updatedUser.firstName + ' ' + updatedUser.lastName,
			initials: updatedUser.firstName[0] + updatedUser.lastName[0],
			mail: updatedUser.email,
			userPassword: updatedUser.password,
			gecos: latinize(updatedUser.firstName + ' ' + updatedUser.lastName),
			gidNumber: '1000',
			homeDirectory: '/home/' + updatedUser.uid,
			loginShell: '/bin/bash',
			ou: 'n7',
			sshPublicKey: updatedUser.sshKeys?.at(0),
		},
		'User does not match the expected values',
	);
});

test.serial('An user can be deleted', async (t) => {
	await deleteLdapUser(user.uid);

	const { searchEntries } = await client.search(`ou=people`, {
		filter: `uid=${user.uid}`,
	});

	t.is(searchEntries.length, 0, 'User was not deleted');
});

test.serial('A list of users can be synced', async (t) => {
	// Create users
	for (const user of users) {
		await upsertLdapUser(user);
	}

	const updatedUsers = users;
	updatedUsers.shift();
	updatedUsers[1].email.push('hello@hello.hello');
	updatedUsers.push({
		uid: 'newuser',
		firstName: 'New',
		lastName: 'User',
		password: hashPassword('hello_world'),
		email: ['user@user.user'],
	});

	await syncLdapUsers(updatedUsers);

	const { searchEntries } = await client.search(`ou=people`, {
		filter: `(|${users.map((user) => `(uid=${user.uid})`).join('')})`,
	});

	t.is(
		searchEntries.length,
		updatedUsers.length,
		'Not all users were synchronized',
	);

	for (const user of updatedUsers) {
		const insertedUser = searchEntries.find(
			(entry) => entry.uid === user.uid,
		);

		t.like(
			insertedUser,
			{
				uid: user.uid,
				cn: user.firstName + ' ' + user.lastName,
				sn: user.lastName,
				givenName: user.firstName,
				displayName: user.firstName + ' ' + user.lastName,
				initials: user.firstName[0] + user.lastName[0],
				mail: user.email.length > 1 ? user.email : user.email[0],
				userPassword: user.password,
				gecos: latinize(user.firstName + ' ' + user.lastName),
				gidNumber: '1000',
				homeDirectory: '/tmp',
				loginShell: '/bin/none',
			},
			'User does not match the expected values',
		);
	}
});

test.after(async () => {
	for (const ldapUser of users) {
		await deleteLdapUser(ldapUser.uid);
	}
	const client = Client.getInstance();
	await client.disconnect();
});
