/**
 * Enum to describe a response status
 */
export enum ResponseStatus {
    Ok,
    Error
}

/**
 * This type combines a value and a status
 */
export type Result<T> = [value: T, status: ResponseStatus];

/**
 * Generic type for objects that provides types for its properties
 */
export type CustomObject<Type> = {
    [Property in keyof Type]: Type[Property];
};
