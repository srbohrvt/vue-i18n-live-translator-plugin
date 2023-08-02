import VueI18n from 'vue-i18n';
export type TranslationMeta = {
    locale: string;
    message: string;
    values?: object;
    path: string;
};
type LiveTranslatorPluginOptions = {
    i18n: VueI18n;
    translationLink: (meta: TranslationMeta) => string;
    persist?: boolean;
};
export declare const LiveTranslatorPlugin: {
    install(app: any, options: LiveTranslatorPluginOptions): void;
};
export {};
