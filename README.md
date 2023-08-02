# Live Translator Plugin for Vue 2

## Install
```bash
npm i -s https://github.com/apicore-engineering/vue-i18n-live-translator-plugin
```

## Use
```typescript
import LiveTranslatorPlugin, { TranslationMeta } from 'vue-i18n-live-translator-plugin'

Vue.use(LiveTranslatorPlugin, {
    i18n,
    translationLink (meta: TranslationMeta) {
        return '' // your platform-specific link to the translation software
    },
    persist: true,
})
```

## Weblate example
```typescript
translationLink (meta: TranslationMeta) {
    return `<weblate_url>/translate/<project>/<component>/${meta.locale}/?q=context:=${meta.path}`
}
```

## Develop
```bash
git clone https://github.com/apicore-engineering/vue-i18n-live-translator-plugin
```
```bash
cd vue-i18n-live-translator-plugin
```
```bash
npm install
```
```bash
husky install
```