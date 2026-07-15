import packageJson from '../package.json';

/** 与 package.json 同步的应用版本（标题栏徽章用） */
export const APP_VERSION = packageJson.version;

export const APP_VERSION_LABEL = `v${APP_VERSION}`;
