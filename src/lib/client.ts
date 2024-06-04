import { ClientOptions, Client as ldaptsClient } from 'ldapts';
import { ILogObj, Logger } from 'tslog';

class Client {
	static #instance: Client;
	client: ldaptsClient | undefined;
	base_dn: string | undefined;
	logger: Logger<ILogObj>;

	private constructor(logs: 'pretty' | 'json' | 'hidden') {
		this.logger = new Logger({ type: logs, name: 'LDAP7' });
	}

	/**
	 * Get the instance
	 *
	 * @param logs
	 */
	public static getInstance(
		logs: 'pretty' | 'json' | 'hidden' = 'pretty'
	): Client {
		if (!Client.#instance) {
			Client.#instance = new Client(logs);
		}

		return Client.#instance;
	}

	/**
	 * Get the client
	 */
	public static getClient() {
		if (!Client.#instance || !Client.#instance.client) {
			throw new Error('Client is not initialized');
		}

		if (!Client.#instance.base_dn) {
			throw new Error('Base DN is not set');
		}

		if (!Client.#instance.client.isConnected) {
			throw new Error('Client is not connected');
		}

		return {
			client: Client.#instance.client,
			logger: Client.#instance.logger,
			base_dn: Client.#instance.base_dn,
		};
	}

	/**
	 * Set up the client
	 *
	 * @param option
	 * @param bind_cn
	 * @param bind_password
	 * @param base_dn
	 */
	async setup(
		option: ClientOptions,
		bind_cn: string,
		bind_password: string,
		base_dn: string
	) {
		if (this.client) {
			await this.client.unbind();
		}
		this.client = new ldaptsClient(option);
		this.base_dn = base_dn;
		await this.client.bind(`${bind_cn},${base_dn}`, bind_password);
		await this.connect();
	}

	/**
	 * Connect to the ldap server
	 */
	async connect() {
		if (!this.client) {
			throw new Error('Client is not initialized');
		}

		if (this.client.isConnected) {
			return;
		}

		await this.client.startTLS();
	}

	/**
	 * Disconnect from the ldap server
	 */
	async disconnect() {
		if (!this.client) {
			throw new Error('Client is not initialized');
		}

		await this.client.unbind();
	}
}

export default Client;
