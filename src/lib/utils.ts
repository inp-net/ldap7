import { ILogObj, Logger } from 'tslog';

/**
 * Get a sub logger
 *
 * @param logger
 * @param name
 */
function getLogger(logger: Logger<ILogObj>, name: string) {
	return logger.getSubLogger({ name });
}

/**
 * Check if the value is an array
 *
 * @param value
 */
function isArray<T>(value: T[] | T): value is T[] {
	return Array.isArray(value);
}

export { getLogger, isArray };
