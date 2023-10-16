import Vue, { VueConstructor } from 'vue';
import VueI18n from 'vue-i18n';
export type TranslationMeta = {
    locale: string;
    message: string;
    values: any;
    path: string;
    uuid: string;
};
type LiveTranslatorPluginOptions = {
    i18n: VueI18n;
    translationLink: (meta: TranslationMeta) => string;
};
export declare const LiveTranslatorPlugin: {
    install(app: VueConstructor<Vue>, options: LiveTranslatorPluginOptions): void;
};
export {};
